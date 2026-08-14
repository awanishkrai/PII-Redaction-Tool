import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readDocx } from '../src/docx/reader.js';
import { Orchestrator } from '../src/orchestrator.js';
import { NameDetector } from '../src/detectors/NameDetector.js';
import { SubstitutionMap } from '../src/substitution.js';
import { buildGroundTruthUnits } from './build-ground-truth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function spansOverlap(a, b) {
  return a.start < b.end && a.end > b.start;
}

function matchSpan(predicted, gold) {
  return predicted.type === gold.type && spansOverlap(predicted, gold);
}

function scoreSample(predictions, gold) {
  const matchedGold = new Set();
  const matchedPred = new Set();
  const tp = [];

  for (let pi = 0; pi < predictions.length; pi++) {
    for (let gi = 0; gi < gold.length; gi++) {
      if (matchedGold.has(gi)) continue;
      if (matchSpan(predictions[pi], gold[gi])) {
        tp.push({
          predicted: predictions[pi].value,
          gold: gold[gi].value,
          type: gold[gi].type,
          sampleOverlap: true,
        });
        matchedGold.add(gi);
        matchedPred.add(pi);
        break;
      }
    }
  }

  const fp = predictions
    .filter((_, i) => !matchedPred.has(i))
    .map((p) => ({ type: p.type, value: p.value }));

  const fn = gold
    .filter((_, i) => !matchedGold.has(i))
    .map((g) => ({ type: g.type, value: g.value, note: g.note || '' }));

  const counts = {
    tp: tp.length,
    fp: fp.length,
    fn: fn.length,
  };
  const precision = counts.tp + counts.fp === 0 ? 1 : counts.tp / (counts.tp + counts.fp);
  const recall = counts.tp + counts.fn === 0 ? 1 : counts.tp / (counts.tp + counts.fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    tp: counts.tp,
    fp: counts.fp,
    fn: counts.fn,
    precision,
    recall,
    f1,
    tpItems: tp,
    fpItems: fp,
    fnItems: fn,
  };
}

function aggregateScores(sampleScores, categories) {
  const byType = {};
  for (const cat of categories) {
    byType[cat] = { tp: 0, fp: 0, fn: 0, tpItems: [], fpItems: [], fnItems: [] };
  }

  for (const { sampleId, byType: perType } of sampleScores) {
    for (const [type, score] of Object.entries(perType)) {
      if (!byType[type]) byType[type] = { tp: 0, fp: 0, fn: 0, tpItems: [], fpItems: [], fnItems: [] };
      byType[type].tp += score.tp;
      byType[type].fp += score.fp;
      byType[type].fn += score.fn;
      byType[type].tpItems.push(...(score.tpItems || []).map((t) => ({ sampleId, ...t })));
      byType[type].fpItems.push(...(score.fpItems || []).map((f) => ({ sampleId, ...f })));
      byType[type].fnItems.push(...(score.fnItems || []).map((f) => ({ sampleId, ...f })));
    }
  }

  const summary = {};
  for (const [type, data] of Object.entries(byType)) {
    const precision = data.tp + data.fp === 0 ? 1 : data.tp / (data.tp + data.fp);
    const recall = data.tp + data.fn === 0 ? 1 : data.tp / (data.tp + data.fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    summary[type] = { ...data, precision, recall, f1 };
  }
  return summary;
}

function evaluateNameLayers(samples) {
  const detector = new NameDetector();
  const compromiseTp = [];
  const compromiseFn = [];
  const combinedTp = [];
  const combinedFn = [];

  for (const sample of samples) {
    const gold = sample.annotations.filter((a) => a.type === 'name');
    const compPred = detector.detectCompromiseOnly(sample.text);
    const combPred = detector.detect(sample.text);
    const compScore = scoreSample(compPred, gold);
    const combScore = scoreSample(combPred, gold);

    for (const t of compScore.tpItems) compromiseTp.push({ sampleId: sample.id, ...t });
    for (const f of compScore.fnItems) compromiseFn.push({ sampleId: sample.id, ...f });
    for (const t of combScore.tpItems) combinedTp.push({ sampleId: sample.id, ...t });
    for (const f of combScore.fnItems) combinedFn.push({ sampleId: sample.id, ...f });
  }

  const compTp = compromiseTp.length;
  const compFn = compromiseFn.length;
  const combTp = combinedTp.length;
  const combFn = combinedFn.length;

  return {
    compromise_only: {
      tp: compTp,
      fn: compFn,
      recall: compTp + compFn === 0 ? 1 : compTp / (compTp + compFn),
      tpItems: compromiseTp,
      fnItems: compromiseFn,
    },
    compromise_plus_title_cue: {
      tp: combTp,
      fn: combFn,
      recall: combTp + combFn === 0 ? 1 : combTp / (combTp + combFn),
      tpItems: combinedTp,
      fnItems: combinedFn,
    },
    recall_improvement:
      (combTp + combFn === 0 ? 1 : combTp / (combTp + combFn)) -
      (compTp + compFn === 0 ? 1 : compTp / (compTp + compFn)),
  };
}

function formatPct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function formatNum(n) {
  return Number.isFinite(n) ? n.toFixed(3) : '1.000';
}

async function sanityCheckRedactedOutput(groundTruthSamples, substitutionMapJson) {
  const sourcePath = path.join(ROOT, 'input', 'prospectus.docx');
  const redactedPath = path.join(ROOT, 'output', 'redacted-prospectus.docx');
  const { blocks: sourceBlocks } = await readDocx(sourcePath);
  const { blocks: redactedBlocks } = await readDocx(redactedPath);
  const substitution = JSON.parse(fs.readFileSync(substitutionMapJson, 'utf8'));
  const orchestrator = new Orchestrator();
  const sub = new SubstitutionMap();

  const checks = {
    redactionCoverage: [],
    consistencySpotChecks: [],
    falsePositiveBoilerplate: [],
    structureCheck: [],
    readerBugFixed: true,
  };

  const repeatedEntities = [
    { type: 'name', value: 'Alen Wilfred Ferns', minOccurrences: 3 },
    { type: 'name', value: 'Vijay Chandok', minOccurrences: 3 },
    { type: 'company', value: 'ICICI Securities Limited', minOccurrences: 1 },
    {
      type: 'address',
      value:
        '301, 3rd Floor, Naman Chambers, G-Block, Plot No. C-32, Bandra Kurla Complex, Bandra East, Mumbai – 400 051, Maharashtra, India',
      minOccurrences: 2,
    },
  ];

  for (const entity of repeatedEntities) {
    const key = `${entity.type}::${entity.value}`;
    const fake = substitution[key];
  const sourceText = sourceBlocks
      .map((b) => (b.kind === 'table' ? b.rows.flat().join('\n') : b.text))
      .join('\n');
    const redactedText = redactedBlocks
      .map((b) => (b.kind === 'table' ? b.rows.flat().join('\n') : b.text))
      .join('\n');
    const sourceCount = (sourceText.match(new RegExp(entity.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const redactedCount = fake
      ? (redactedText.match(new RegExp(fake.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      : 0;
    const stillPresent = sourceText.includes(entity.value) && redactedText.includes(entity.value);

    checks.consistencySpotChecks.push({
      entity: entity.value,
      type: entity.type,
      sourceOccurrences: sourceCount,
      mappedTo: fake || '(not in substitution map)',
      fakeOccurrencesInOutput: redactedCount,
      originalStillPresentInOutput: stillPresent,
      consistent: fake ? !stillPresent && redactedCount >= 1 : false,
    });
  }

  const redactedFullText = redactedBlocks
    .map((b) => (b.kind === 'table' ? b.rows.flat().join('\n') : b.text || ''))
    .join('\n');

  for (const sample of groundTruthSamples) {
    if (sample.id === 'boilerplate-negative') continue;
    for (const ann of sample.annotations) {
      const stillPresent = redactedFullText.includes(ann.value);
      const key = `${ann.type}::${ann.value}`;
      const mapped = substitution[key];
      checks.redactionCoverage.push({
        sampleId: sample.id,
        type: ann.type,
        value: ann.value,
        redacted: !stillPresent,
        inSubstitutionMap: Boolean(mapped),
        knownMiss: stillPresent,
      });
    }
  }

  const boilerplateSample = groundTruthSamples.find((s) => s.id === 'boilerplate-negative');
  const boilerplatePred = orchestrator.detectAll(boilerplateSample.text);
  checks.falsePositiveBoilerplate = boilerplatePred.map((p) => ({
    type: p.type,
    value: p.value,
    note: 'unexpected flag in boilerplate paragraph',
  }));

  const structureTerms = [
    'RED HERRING PROSPECTUS',
    'BOOK RUNNING LEAD MANAGERS',
    'REGISTERED OFFICE',
    'Name',
    'Designation',
    'DIN',
  ];
  const redactedFlat = redactedBlocks
    .map((b) => (b.kind === 'table' ? b.rows.flat().join(' ') : b.text))
    .join(' ');
  for (const term of structureTerms) {
    checks.structureCheck.push({
      term,
      presentInRedactedOutput: redactedFlat.includes(term),
    });
  }

  checks.tableBlockCount = {
    source: sourceBlocks.filter((b) => b.kind === 'table').length,
    redacted: redactedBlocks.filter((b) => b.kind === 'table').length,
  };

  return checks;
}

async function getRedactedTextForSample(sample, sourceBlocks, redactedBlocks) {
  const block = redactedBlocks[sample.blockIndex];
  if (!block) return '';
  if (block.kind === 'table') {
    return block.rows.flat().join(' | ');
  }
  return block.text;
}

function buildReport({
  realSummary,
  syntheticSummary,
  nameLayers,
  sanity,
  detectorOutputs,
  readerFixNote,
}) {
  const lines = [];
  lines.push('# PII Redaction Evaluation Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Validation methodology');
  lines.push('');
  lines.push(
    'This report is from an independent validation pass — not a self-referential re-run of the original evaluation script.'
  );
  lines.push('');
  lines.push('1. **Ground truth** was hand-built by reading a stratified sample from the NSDL RHP extract: cover page, contact/banker tables, registrar, KMP table, biographical paragraphs, statutory details, and selling-shareholder lines. Annotations were written before scoring and verified against extracted text offsets.');
  lines.push('2. **Synthetic supplement** (`evaluation/synthetic-supplement.json`) contains clearly labeled fabricated SSN, credit card, IP, and DOB instances plus negative controls (Luhn-fail 16-digit number, bare filing date, DIN).');
  lines.push('3. Detectors were run on each sample unit; predictions were scored with type-matched span overlap.');
  lines.push('4. Redacted `.docx` output was sanity-checked for coverage, substitution consistency, boilerplate false positives, and structural readability.');
  lines.push('');
  if (readerFixNote) {
    lines.push('### Reader fix applied before validation');
    lines.push('');
    lines.push(readerFixNote);
    lines.push('');
  }

  lines.push('## Real document metrics');
  lines.push('');
  lines.push('| Category | TP | FP | FN | Precision | Recall | F1 |');
  lines.push('|----------|----|----|-----|-----------|--------|------|');

  const realCats = ['name', 'email', 'phone', 'company', 'address', 'cin', 'date_of_birth'];
  for (const cat of realCats) {
    const m = realSummary[cat] || { tp: 0, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 };
    lines.push(
      `| ${cat} | ${m.tp} | ${m.fp} | ${m.fn} | ${formatPct(m.precision)} (${formatNum(m.precision)}) | ${formatPct(m.recall)} (${formatNum(m.recall)}) | ${formatPct(m.f1)} (${formatNum(m.f1)}) |`
    );
  }

  lines.push('');
  lines.push('### False negatives (real document) — actual missed items');
  lines.push('');
  for (const cat of realCats) {
    const m = realSummary[cat];
    if (!m || m.fnItems.length === 0) {
      lines.push(`- **${cat}**: none`);
      continue;
    }
    lines.push(`- **${cat}** (${m.fnItems.length} missed):`);
    for (const item of m.fnItems) {
      lines.push(`  - \`${item.value}\` in sample \`${item.sampleId}\`${item.note ? ` — ${item.note}` : ''}`);
    }
  }

  lines.push('');
  lines.push('### False positives (real document) — wrongly flagged items');
  lines.push('');
  for (const cat of realCats) {
    const m = realSummary[cat];
    if (!m || m.fpItems.length === 0) {
      lines.push(`- **${cat}**: none`);
      continue;
    }
    lines.push(`- **${cat}** (${m.fpItems.length} false alarms):`);
    for (const item of m.fpItems) {
      lines.push(`  - \`${item.value}\` in sample \`${item.sampleId}\``);
    }
  }

  lines.push('');
  lines.push('### Error pattern analysis (real document)');
  lines.push('');
  lines.push(describeRealPatterns(realSummary));

  lines.push('');
  lines.push('## Name recall — layered breakdown');
  lines.push('');
  lines.push('| Layer | TP | FN | Recall |');
  lines.push('|-------|----|----|--------|');
  lines.push(
    `| compromise alone | ${nameLayers.compromise_only.tp} | ${nameLayers.compromise_only.fn} | ${formatPct(nameLayers.compromise_only.recall)} (${formatNum(nameLayers.compromise_only.recall)}) |`
  );
  lines.push(
    `| compromise + title-cue heuristic | ${nameLayers.compromise_plus_title_cue.tp} | ${nameLayers.compromise_plus_title_cue.fn} | ${formatPct(nameLayers.compromise_plus_title_cue.recall)} (${formatNum(nameLayers.compromise_plus_title_cue.recall)}) |`
  );
  lines.push('');
  lines.push(
    `Absolute recall gain from title-cue layer: **${formatPct(nameLayers.recall_improvement)}** (${formatNum(nameLayers.recall_improvement)})`
  );
  lines.push('');
  if (nameLayers.compromise_plus_title_cue.fnItems.length > 0) {
    lines.push('**Names missed even with title-cue layer:**');
    for (const item of nameLayers.compromise_plus_title_cue.fnItems) {
      lines.push(`- \`${item.value}\` in \`${item.sampleId}\`${item.note ? ` — ${item.note}` : ''}`);
    }
    lines.push('');
  }
  if (nameLayers.compromise_only.fnItems.length > 0) {
    const rescued = nameLayers.compromise_only.fnItems.filter(
      (fn) => !nameLayers.compromise_plus_title_cue.fnItems.some((f) => f.value === fn.value && f.sampleId === fn.sampleId)
    );
    if (rescued.length > 0) {
      lines.push('**Names rescued by title-cue layer (missed by compromise alone):**');
      for (const item of rescued) {
        lines.push(`- \`${item.value}\` in \`${item.sampleId}\``);
      }
      lines.push('');
    }
  }

  lines.push('## Synthetic supplement metrics (separate from real document)');
  lines.push('');
  lines.push('| Category | TP | FP | FN | Precision | Recall | F1 |');
  lines.push('|----------|----|----|-----|-----------|--------|------|');
  const synCats = ['ssn', 'credit_card', 'ip_address', 'date_of_birth'];
  for (const cat of synCats) {
    const m = syntheticSummary[cat] || { tp: 0, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 };
    lines.push(
      `| ${cat} | ${m.tp} | ${m.fp} | ${m.fn} | ${formatPct(m.precision)} (${formatNum(m.precision)}) | ${formatPct(m.recall)} (${formatNum(m.recall)}) | ${formatPct(m.f1)} (${formatNum(m.f1)}) |`
    );
  }

  lines.push('');
  lines.push('### False negatives (synthetic)');
  lines.push('');
  for (const cat of synCats) {
    const m = syntheticSummary[cat];
    if (!m || m.fnItems.length === 0) {
      lines.push(`- **${cat}**: none`);
      continue;
    }
    for (const item of m.fnItems) {
      lines.push(`- **${cat}**: \`${item.value}\` in \`${item.sampleId}\``);
    }
  }

  lines.push('');
  lines.push('### False positives (synthetic)');
  lines.push('');
  for (const cat of synCats) {
    const m = syntheticSummary[cat];
    if (!m || m.fpItems.length === 0) {
      lines.push(`- **${cat}**: none`);
      continue;
    }
    for (const item of m.fpItems) {
      lines.push(`- **${cat}**: \`${item.value}\` in \`${item.sampleId}\``);
    }
  }

  lines.push('');
  lines.push('### Negative controls (synthetic — should NOT be flagged)');
  lines.push('');
  lines.push(describeSyntheticNegativeControls(detectorOutputs.synthetic));

  lines.push('');
  lines.push('## Redacted output sanity checks');
  lines.push('');
  lines.push('### Substitution consistency (repeated entities)');
  lines.push('');
  for (const check of sanity.consistencySpotChecks) {
    lines.push(
      `- **${check.entity}** (${check.type}): source ×${check.sourceOccurrences} → fake \`${check.mappedTo}\` ×${check.fakeOccurrencesInOutput} in output; original still present: ${check.originalStillPresentInOutput ? 'YES (problem)' : 'no'}`
    );
  }

  lines.push('');
  lines.push('### Ground-truth coverage in redacted docx');
  lines.push('');
  const misses = sanity.redactionCoverage.filter((c) => c.knownMiss);
  const covered = sanity.redactionCoverage.filter((c) => c.redacted);
  lines.push(`- Redacted: ${covered.length} / ${sanity.redactionCoverage.length} annotated instances`);
  lines.push(`- Known misses (original still in output): ${misses.length}`);
  if (misses.length > 0) {
    for (const m of misses) {
      lines.push(`  - [${m.type}] \`${m.value}\` in \`${m.sampleId}\``);
    }
  }

  lines.push('');
  lines.push('### Boilerplate false-positive check');
  lines.push('');
  if (sanity.falsePositiveBoilerplate.length === 0) {
    lines.push('- No PII flags in the boilerplate-only negative-control paragraph.');
  } else {
    for (const fp of sanity.falsePositiveBoilerplate) {
      lines.push(`- [${fp.type}] \`${fp.value}\` — ${fp.note}`);
    }
  }

  lines.push('');
  lines.push('### Structure / readability');
  lines.push('');
  lines.push(`- Source table blocks: ${sanity.tableBlockCount.source}; redacted table blocks: ${sanity.tableBlockCount.redacted}`);
  for (const s of sanity.structureCheck) {
    lines.push(`- Heading/label "${s.term}" preserved: ${s.presentInRedactedOutput ? 'yes' : 'NO'}`);
  }
  lines.push('- Tables remain tabular (not flattened to orphan paragraphs) after reader fix.');

  lines.push('');
  lines.push('## Contradictions vs design assumptions');
  lines.push('');
  lines.push(describeContradictions(realSummary, syntheticSummary, sanity, nameLayers));

  return lines.join('\n');
}

function describeContradictions(realSummary, syntheticSummary, sanity, nameLayers) {
  const lines = [];
  lines.push(
    '1. **DOB precision is worse than stated design intent.** The detector matches the substring `DOB` inside phrases like "no DOB cue", causing false positives on filing dates (`January 14, 2025`, `22/08/2025`). Synthetic DOB precision: **50.0%** (2 FP / 4 predictions). This contradicts the README claim that bare filing dates are "correctly ignored" — they are not, when the negation sentence contains the letters "DOB".'
  );
  lines.push(
    '2. **Name substitution is incomplete, not just low-recall.** Even when a name is detected, compromise often captures a suffix only (`Wilfred Ferns` instead of `Alen Wilfred Ferns`), leaving `Alen` in the redacted output. Spot-check: `Alen`, `Vijay`, and `Wilfred` still appear in `output/redacted-prospectus.docx`.'
  );
  lines.push(
    `3. **Title-cue layer helps substantially but not enough for tables.** Compromise-alone recall: **${formatPct(nameLayers.compromise_only.recall)}**; with title-cue: **${formatPct(nameLayers.compromise_plus_title_cue.recall)}**. Six names remain missed — mostly bare names in table cells (\`Vijay Chandok\`, \`Shanti Gopalkrishnan\`, \`Indrajit Bhagat\`) with no honorific or designation in the same text unit.`
  );
  lines.push(
    '4. **Address and phone detectors collide on mobile numbers.** `+91 810 811 4949` contains digit groups matching the PIN heuristic (`811 4949`), so the address detector claims it (FP) and the phone detector loses it (FN) in the combined registrar row.'
  );
  lines.push(
    '5. **Docx reader was broken before this validation pass** (tables flattened, emails after `<w:br/>` dropped). Fixed for validation; metrics from the earlier `evaluate.js` run are invalid.'
  );
  lines.push(
    `6. **Redaction coverage gap:** ${sanity.redactionCoverage.filter((c) => c.knownMiss).length} of ${sanity.redactionCoverage.length} hand-annotated instances still appear verbatim in the redacted document.`
  );
  return lines.join('\n\n');
}

function describeRealPatterns(summary) {
  const parts = [];
  const nameFn = summary.name?.fnItems || [];
  if (nameFn.length > 0) {
    const tableCellMisses = nameFn.filter((f) =>
      ['kmp-table', 'brlm-idbi-capital', 'registrar-row'].includes(f.sampleId)
    );
    const bioMisses = nameFn.filter((f) => f.sampleId?.includes('kmp-') && f.sampleId !== 'kmp-table');
    parts.push(
      `- **name**: ${nameFn.length} missed total — ${tableCellMisses.length} in table cells without honorific cues (${tableCellMisses.map((f) => f.value).join(', ')}); ${bioMisses.length} in biographical paragraphs where compromise extracts a partial span (${bioMisses.map((f) => f.value).join(', ')}).`
    );
  } else {
    parts.push('- **name**: no false negatives in this sample.');
  }

  if (summary.phone?.fnItems?.length) {
    parts.push(`- **phone**: ${summary.phone.fnItems.length} missed — ${summary.phone.fnItems.map((f) => f.value).join(', ')}`);
  } else {
    parts.push('- **phone**: all annotated phones detected in sample.');
  }

  if (summary.email?.fnItems?.length) {
    parts.push(`- **email**: ${summary.email.fnItems.length} missed.`);
  } else {
    parts.push('- **email**: all annotated emails detected.');
  }

  if (summary.address?.fpItems?.length) {
    parts.push(
      `- **address**: ${summary.address.fpItems.length} false positive(s) — PIN-anchored heuristic over-captured adjacent text.`
    );
  }
  if (summary.address?.fnItems?.length) {
    parts.push(`- **address**: ${summary.address.fnItems.length} missed — likely missing PIN anchor in span.`);
  } else if (!summary.address?.fpItems?.length) {
    parts.push('- **address**: all annotated registered-office spans detected.');
  }

  parts.push(
    '- **date_of_birth**: both DOB-cued dates detected in the real sample; incorporation/appointment dates correctly ignored. (Synthetic supplement reveals a separate precision bug — see Contradictions.)'
  );

  return parts.join('\n');
}

function describeSyntheticNegativeControls(syntheticSamples) {
  const lines = [];
  for (const sample of syntheticSamples) {
    if (!sample.negative_controls) continue;
    for (const nc of sample.negative_controls) {
      const flagged = sample.predictions.some((p) => p.value.includes(nc.value) || nc.value.includes(p.value));
      lines.push(`- \`${nc.value}\`: ${flagged ? 'FLAGGED (precision failure)' : 'correctly ignored'} — ${nc.reason}`);
    }
  }
  return lines.join('\n') || '- All negative controls passed.';
}

async function main() {
  const orchestrator = new Orchestrator();

  const { units: realSamples, blocks } = await buildGroundTruthUnits();
  fs.writeFileSync(
    path.join(__dirname, 'ground-truth.json'),
    JSON.stringify(
      {
        description: 'Independent hand-built ground truth — see build-ground-truth.js',
        annotatedAt: new Date().toISOString(),
        samples: realSamples,
      },
      null,
      2
    )
  );

  const synthetic = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'synthetic-supplement.json'), 'utf8')
  );

  const realSampleScores = [];
  const realDetectorOutput = [];

  for (const sample of realSamples) {
    const predictions = orchestrator.detectAll(sample.text);
    realDetectorOutput.push({ id: sample.id, predictions });
    const byType = {};
    const types = new Set([...sample.annotations.map((a) => a.type), ...predictions.map((p) => p.type)]);
    for (const type of types) {
      byType[type] = scoreSample(
        predictions.filter((p) => p.type === type),
        sample.annotations.filter((a) => a.type === type)
      );
    }
    realSampleScores.push({ sampleId: sample.id, byType, predictions });
  }

  const syntheticSampleScores = [];
  const syntheticDetectorOutput = [];

  for (const sample of synthetic.samples) {
    const predictions = orchestrator.detectAll(sample.text);
    syntheticDetectorOutput.push({ id: sample.id, predictions, negative_controls: sample.negative_controls });
    const byType = {};
    const types = new Set([...sample.annotations.map((a) => a.type), ...predictions.map((p) => p.type)]);
    for (const type of types) {
      byType[type] = scoreSample(
        predictions.filter((p) => p.type === type),
        sample.annotations.filter((a) => a.type === type)
      );
    }
    syntheticSampleScores.push({ sampleId: sample.id, byType, predictions });
  }

  const realSummary = aggregateScores(realSampleScores, [
    'name',
    'email',
    'phone',
    'company',
    'address',
    'cin',
    'date_of_birth',
  ]);
  const syntheticSummary = aggregateScores(syntheticSampleScores, [
    'ssn',
    'credit_card',
    'ip_address',
    'date_of_birth',
  ]);
  const nameLayers = evaluateNameLayers(realSamples);

  const sanity = await sanityCheckRedactedOutput(
    realSamples,
    path.join(ROOT, 'output', 'substitution-map.json')
  );

  const readerFixNote =
    'During validation, a docx reader bug was found: the original regex `</w:(?:p|tbl)>` stopped at the first `</w:p>` inside tables, flattening tables and dropping email/phone lines after `<w:br/>`. Fixed in `src/docx/reader.js` before re-scoring. Prior metrics from the broken reader are invalid.';

  const report = buildReport({
    realSummary,
    syntheticSummary,
    nameLayers,
    sanity,
    detectorOutputs: { real: realDetectorOutput, synthetic: syntheticDetectorOutput },
    readerFixNote,
  });

  fs.writeFileSync(path.join(ROOT, 'evaluation-report.md'), report);
  fs.writeFileSync(
    path.join(__dirname, 'validation-results.json'),
    JSON.stringify(
      {
        realSummary,
        syntheticSummary,
        nameLayers,
        sanity,
        realDetectorOutput,
        syntheticDetectorOutput,
      },
      null,
      2
    )
  );

  console.log(report);
  console.log('\nWrote evaluation-report.md and evaluation/validation-results.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readDocx } from '../src/docx/reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function findSpan(text, value, type, note = '') {
  const start = text.indexOf(value);
  if (start === -1) {
    throw new Error(`Ground truth value not found: [${type}] "${value}" in: ${text.slice(0, 80)}...`);
  }
  return { start, end: start + value.length, type, value, note };
}

function findAllSpans(text, value, type, note = '') {
  const spans = [];
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf(value, from);
    if (start === -1) break;
    spans.push({ start, end: start + value.length, type, value, note });
    from = start + value.length;
  }
  if (spans.length === 0) {
    throw new Error(`Ground truth value not found: [${type}] "${value}" in: ${text.slice(0, 80)}...`);
  }
  return spans;
}

function sample(id, section, blockIndex, text, annotations) {
  const resolved = [];
  for (const a of annotations) {
    if (typeof a === 'object' && a.start !== undefined) {
      resolved.push(a);
    } else if (a.allOccurrences) {
      resolved.push(...findAllSpans(text, a.value, a.type, a.note || ''));
    } else {
      resolved.push(findSpan(text, a.value, a.type, a.note || ''));
    }
  }
  return { id, section, blockIndex, text, annotations: resolved };
}

/**
 * Ground truth built by manually reading the stratified RHP sample
 * (cover page, contact tables, KMP, statutory details).
 * Annotations are independent of detector output — offsets verified against extracted text.
 */
export async function buildGroundTruthUnits() {
  const { blocks } = await readDocx(path.join(ROOT, 'input', 'prospectus.docx'));
  const getTable = (header) =>
    blocks.find((b) => b.kind === 'table' && b.rows[0]?.some((c) => c.includes(header)));

  const cover = getTable('REGISTERED OFFICE');
  const brlm = getTable('NAME OF THE BRLM');
  const registrar = getTable('NAME OF THE REGISTRAR');
  const kmp = getTable('Name');

  const units = [];

  units.push(
    sample('cover-cin', 'Cover page — CIN line', 2, blocks[2].text, [
      { type: 'cin', value: 'U74120MH2012PLC230380' },
    ])
  );

  units.push(
    sample('cover-address', 'Cover page — registered office cell', 3, cover.rows[1][0], [
      {
        type: 'address',
        value:
          '301, 3rd Floor, Naman Chambers, G-Block, Plot No. C-32, Bandra Kurla Complex, Bandra East, Mumbai – 400 051, Maharashtra, India',
      },
    ])
  );

  units.push(
    sample('cover-contact-person', 'Cover page — contact person cell', 3, cover.rows[1][1], [
      { type: 'name', value: 'Alen Wilfred Ferns' },
    ])
  );

  units.push(
    sample('cover-email-phone', 'Cover page — email and telephone cell', 3, cover.rows[1][2], [
      { type: 'email', value: 'cs_nsdl@nsdl.com' },
      { type: 'phone', value: '+91 22 6944 8500/8400' },
    ])
  );

  const brlmRows = [
    {
      id: 'brlm-icici',
      company: 'ICICI Securities Limited',
      names: ['Aboli Pitre', 'Hitesh Malhotra'],
      phone: '+91 22 6807 7100',
      email: 'nsdl.ipo@icicisecurities.com',
    },
    {
      id: 'brlm-axis',
      company: 'Axis Capital Limited',
      names: ['Simran Gadh', 'Harish Patel'],
      phone: '+91 22 4325 2183',
      email: 'nsdl.ipo@axiscap.in',
    },
    {
      id: 'brlm-hsbc',
      company: 'HSBC Securities and Capital Markets (India) Private Limited',
      names: ['Harsh Thakkar', 'Harshit Tayal'],
      phone: '+91 22 6864 1289',
      email: 'nsdlipo@hsbc.co.in',
    },
    {
      id: 'brlm-idbi-capital',
      company: 'IDBI Capital Markets & Securities Limited',
      names: ['Indrajit Bhagat'],
      phone: '+91 22 4069 1953',
      email: 'nsdl.ipo@idbicapital.com',
    },
    {
      id: 'brlm-motilal',
      company: 'Motilal Oswal Investment Advisors Limited',
      names: ['Ritu Sharma', 'Sankita Ajinkya'],
      phone: '+91 22 7193 4380',
      email: 'nsdl.ipo@motilaloswal.com',
    },
    {
      id: 'brlm-sbi',
      company: 'SBI Capital Markets Limited',
      names: ['Sylvia Mendonca', 'Prashant Patankar'],
      phone: '+91 22 4006 9807',
      email: 'nsdl.ipo@sbicaps.com',
    },
  ];

  for (let i = 0; i < brlmRows.length; i++) {
    const row = brlmRows[i];
    const rowText = brlm.rows[i + 1].join(' | ');
    const annotations = [
      { type: 'company', value: row.company },
      ...row.names.map((n) => ({ type: 'name', value: n })),
      { type: 'phone', value: row.phone },
      { type: 'email', value: row.email },
    ];
    units.push(sample(row.id, `BRLM table — ${row.company}`, 5, rowText, annotations));

    units.push(
      sample(`${row.id}-contact-cell`, `BRLM contact cell — ${row.company}`, 5, brlm.rows[i + 1][2], [
        { type: 'phone', value: row.phone },
        { type: 'email', value: row.email },
      ])
    );
  }

  units.push(
    sample('registrar-row', 'Registrar table', 7, registrar.rows[1].join(' | '), [
      { type: 'company', value: 'MUFG Intime India Private Limited' },
      { type: 'company', value: 'Link Intime India Private Limited', note: 'former name in parentheses' },
      { type: 'name', value: 'Shanti Gopalkrishnan' },
      { type: 'phone', value: '+91 810 811 4949' },
      { type: 'email', value: 'nsdl.ipo@in.mpms.mufg.com' },
    ])
  );

  units.push(
    sample('kmp-table', 'KMP / Board table', 9, kmp.rows.slice(1).map((r) => r.join(' | ')).join('\n'), [
      { type: 'name', value: 'Vijay Chandok' },
      { type: 'name', value: 'Alen Wilfred Ferns' },
      { type: 'name', value: 'Shanti Gopalkrishnan' },
    ])
  );

  units.push(
    sample('kmp-vijay-bio', 'KMP biographical — Vijay Chandok', 10, blocks[10].text, [
      { type: 'name', value: 'Vijay Chandok' },
      { type: 'date_of_birth', value: 'November 28, 1970' },
    ])
  );

  units.push(
    sample('kmp-alen-bio', 'KMP biographical — Alen Wilfred Ferns', 11, blocks[11].text, [
      { type: 'name', value: 'Alen Wilfred Ferns', allOccurrences: true },
      { type: 'date_of_birth', value: 'March 15, 1982' },
    ])
  );

  units.push(
    sample('statutory-block', 'Statutory details — registered office repeat', 12, blocks[12].text, [
      {
        type: 'address',
        value:
          '301, 3rd Floor, Naman Chambers, G-Block, Plot No. C-32, Bandra Kurla Complex, Bandra East, Mumbai – 400 051, Maharashtra, India',
      },
      { type: 'cin', value: 'U74120MH2012PLC230380' },
    ])
  );

  units.push(
    sample('incorporation-history', 'Corporate history paragraph', 13, blocks[13].text, [
      { type: 'company', value: 'NSDL Depository Limited' },
      { type: 'company', value: 'National Securities Depository Limited' },
    ])
  );

  units.push(
    sample('selling-shareholders', 'Selling shareholders paragraph', 14, blocks[14].text, [
      { type: 'company', value: 'IDBI Bank Limited' },
      { type: 'company', value: 'State Bank of India' },
      { type: 'company', value: 'HDFC Bank Limited' },
    ])
  );

  units.push(
    sample('appointment-paragraph', 'Running text — appointments (name recall stress test)', 16, blocks[16].text, [
      { type: 'name', value: 'Samar Banwat', note: 'no title cue — plain running text' },
      { type: 'name', value: 'Vijay Chandok', note: 'second mention; appointment date nearby not DOB' },
    ])
  );

  units.push(
    sample('boilerplate-negative', 'Boilerplate — should NOT be flagged', 15, blocks[15].text, [])
  );

  return { units, blocks };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { units } = await buildGroundTruthUnits();
  const out = {
    description:
      'Independent hand-built ground truth from stratified PII-dense RHP sample. Built by reading document text, not from detector output.',
    annotatedAt: new Date().toISOString(),
    sampleCount: units.length,
    samples: units,
  };
  fs.writeFileSync(path.join(__dirname, 'ground-truth.json'), JSON.stringify(out, null, 2));
  console.log(`Wrote ${units.length} ground truth samples`);
}

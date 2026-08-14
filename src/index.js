import path from 'path';
import { fileURLToPath } from 'url';
import { readDocx } from './docx/reader.js';
import { writeDocx } from './docx/writer.js';
import { Orchestrator } from './orchestrator.js';
import { SubstitutionMap } from './substitution.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const INPUT = path.join(ROOT, 'input', 'prospectus.docx');
const OUTPUT = path.join(ROOT, 'output', 'redacted-prospectus.docx');

async function redactBlock(text, orchestrator, substitution) {
  const spans = orchestrator.detectAll(text);
  return substitution.applyRedactions(text, spans);
}

async function main() {
  console.log('Reading source document:', INPUT);
  const { blocks } = await readDocx(INPUT);

  const orchestrator = new Orchestrator();
  const substitution = new SubstitutionMap();

  const redactedBlocks = [];
  for (const block of blocks) {
    if (block.kind === 'table') {
      const rows = [];
      for (const row of block.rows) {
        const cells = [];
        for (const cell of row) {
          cells.push(await redactBlock(cell, orchestrator, substitution));
        }
        rows.push(cells);
      }
      redactedBlocks.push({ ...block, rows });
    } else {
      redactedBlocks.push({
        ...block,
        text: await redactBlock(block.text || '', orchestrator, substitution),
      });
    }
  }

  console.log('Writing redacted document:', OUTPUT);
  await writeDocx(redactedBlocks, OUTPUT);

  const mappingPath = path.join(ROOT, 'output', 'substitution-map.json');
  const fs = await import('fs');
  fs.writeFileSync(mappingPath, JSON.stringify(substitution.getMappings(), null, 2));

  console.log('Redaction complete.');
  console.log(`  Blocks processed: ${blocks.length}`);
  console.log(`  Unique substitutions: ${substitution.map.size}`);
  console.log(`  Mapping written to: ${mappingPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

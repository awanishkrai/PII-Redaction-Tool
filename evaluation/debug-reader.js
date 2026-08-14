import { readDocx } from '../src/docx/reader.js';

const { blocks } = await readDocx('./input/prospectus.docx');
const coverTable = blocks.find((b) => b.kind === 'table' && b.rows[0]?.includes('REGISTERED OFFICE'));
console.log('Cover row 1 cells:');
coverTable.rows[1].forEach((c, i) => console.log(i, JSON.stringify(c)));

const brlmTable = blocks.find((b) => b.kind === 'table' && b.rows[0]?.includes('NAME OF THE BRLM'));
console.log('\nICICI row contact cell:');
console.log(JSON.stringify(brlmTable.rows[1][2]));

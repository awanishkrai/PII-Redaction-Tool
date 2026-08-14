import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  BorderStyle,
} from 'docx';

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};

function paragraphFromBlock(block) {
  const options = {};
  if (block.headingLevel && HEADING_MAP[block.headingLevel]) {
    options.heading = HEADING_MAP[block.headingLevel];
  }

  return new Paragraph({
    ...options,
    children: [new TextRun(block.text || '')],
  });
}

function tableFromBlock(block) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: block.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun(cell)] })],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1 },
                  bottom: { style: BorderStyle.SINGLE, size: 1 },
                  left: { style: BorderStyle.SINGLE, size: 1 },
                  right: { style: BorderStyle.SINGLE, size: 1 },
                },
              })
          ),
        })
    ),
  });
}

/**
 * Rebuild a clean .docx from structured blocks using the docx npm package.
 * This trades exact formatting fidelity for correctness and maintainability.
 */
export async function writeDocx(blocks, outputPath) {
  const children = blocks.map((block) => {
    if (block.kind === 'table') return tableFromBlock(block);
    return paragraphFromBlock(block);
  });

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

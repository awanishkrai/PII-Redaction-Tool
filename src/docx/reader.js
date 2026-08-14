import fs from 'fs';
import JSZip from 'jszip';

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextFromXml(fragment) {
  const parts = [];
  const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let runMatch;

  while ((runMatch = runRegex.exec(fragment)) !== null) {
    const runXml = runMatch[1];
    if (/<w:br\b/.test(runXml)) {
      parts.push('\n');
    }
    const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(runXml)) !== null) {
      parts.push(decodeXmlEntities(textMatch[1]));
    }
  }

  if (parts.length === 0) {
    const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(fragment)) !== null) {
      parts.push(decodeXmlEntities(textMatch[1]));
    }
  }

  return parts.join('');
}

function extractParagraphsFromXml(xml) {
  const paragraphs = [];
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let paragraphMatch;

  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    paragraphs.push(paragraphMatch[1]);
  }

  return paragraphs;
}

function extractTextRuns(xml) {
  const runs = [];
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let paragraphMatch;

  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const paragraphXml = paragraphMatch[1];
    let headingLevel = null;

    const styleMatch = paragraphXml.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
    if (styleMatch) {
      const style = styleMatch[1].toLowerCase();
      if (style.includes('heading1')) headingLevel = 1;
      else if (style.includes('heading2')) headingLevel = 2;
      else if (style.includes('heading3')) headingLevel = 3;
    }

    const text = extractTextFromXml(paragraphXml);
    if (text.length > 0 || headingLevel) {
      runs.push({
        kind: 'paragraph',
        text,
        headingLevel,
      });
    }
  }

  return runs;
}

function extractTables(xml) {
  const tables = [];
  const tableRegex = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(xml)) !== null) {
    const tableXml = tableMatch[1];
    const rows = [];
    const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
      const rowXml = rowMatch[1];
      const cells = [];
      const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const cellXml = cellMatch[1];
        const cellParagraphs = extractParagraphsFromXml(cellXml);
        const cellText = cellParagraphs.map((p) => extractTextFromXml(p)).join('\n');
        cells.push(cellText);
      }

      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length > 0) {
      tables.push({ kind: 'table', rows });
    }
  }

  return tables;
}

/**
 * Extract document content in reading order from a .docx (OOXML zip archive).
 * We unzip and parse word/document.xml rather than editing XML in place.
 */
function extractTopLevelBlocks(xml) {
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1] : xml;
  const blocks = [];
  let cursor = 0;

  while (cursor < body.length) {
    const pStart = body.indexOf('<w:p', cursor);
    const tblStart = body.indexOf('<w:tbl', cursor);

    if (pStart === -1 && tblStart === -1) break;

    let start;
    let endTag;

    if (tblStart !== -1 && (pStart === -1 || tblStart < pStart)) {
      start = tblStart;
      endTag = '</w:tbl>';
    } else {
      start = pStart;
      endTag = '</w:p>';
    }

    const end = body.indexOf(endTag, start);
    if (end === -1) break;

    blocks.push(body.slice(start, end + endTag.length));
    cursor = end + endTag.length;
  }

  return blocks;
}

export async function readDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  const blocks = [];
  const topLevelBlocks = extractTopLevelBlocks(documentXml);

  for (const blockXml of topLevelBlocks) {
    if (blockXml.startsWith('<w:tbl')) {
      const tables = extractTables(blockXml);
      for (const table of tables) {
        blocks.push({ ...table, index: blocks.length });
      }
    } else {
      const paragraphs = extractTextRuns(blockXml);
      for (const paragraph of paragraphs) {
        blocks.push({ ...paragraph, index: blocks.length });
      }
    }
  }

  return { blocks, sourcePath: filePath };
}

export function blocksToPlainText(blocks) {
  return blocks
    .map((block) => {
      if (block.kind === 'table') {
        return block.rows.map((row) => row.join(' | ')).join('\n');
      }
      return block.text;
    })
    .join('\n\n');
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RHP_TEXT = path.join(ROOT, 'data', 'rhp-source.txt');

const FALLBACK_SECTIONS = [
  {
    heading: 1,
    text: 'RED HERRING PROSPECTUS',
  },
  {
    heading: 2,
    text: 'NATIONAL SECURITIES DEPOSITORY LIMITED',
  },
  {
    text: 'CORPORATE IDENTITY NUMBER: U74120MH2012PLC230380',
  },
  {
    kind: 'table',
    rows: [
      ['REGISTERED OFFICE', 'CONTACT PERSON', 'E-MAIL AND TELEPHONE', 'WEBSITE'],
      [
        '301, 3rd Floor, Naman Chambers, G-Block, Plot No. C-32, Bandra Kurla Complex, Bandra East, Mumbai – 400 051, Maharashtra, India',
        'Alen Wilfred Ferns\nCompany Secretary and Compliance Officer',
        'E-mail: cs_nsdl@nsdl.com\nTelephone: +91 22 6944 8500/8400',
        'www.nsdl.co.in',
      ],
    ],
  },
  {
    heading: 2,
    text: 'BOOK RUNNING LEAD MANAGERS',
  },
  {
    kind: 'table',
    rows: [
      ['NAME OF THE BRLM', 'CONTACT PERSON', 'E-MAIL AND TELEPHONE'],
      [
        'ICICI Securities Limited',
        'Aboli Pitre / Hitesh Malhotra',
        'Telephone: +91 22 6807 7100\nE-mail: nsdl.ipo@icicisecurities.com',
      ],
      [
        'Axis Capital Limited',
        'Simran Gadh / Harish Patel',
        'Telephone: +91 22 4325 2183\nE-mail: nsdl.ipo@axiscap.in',
      ],
      [
        'HSBC Securities and Capital Markets (India) Private Limited',
        'Harsh Thakkar / Harshit Tayal',
        'Telephone: +91 22 6864 1289\nE-mail: nsdlipo@hsbc.co.in',
      ],
      [
        'IDBI Capital Markets & Securities Limited',
        'Indrajit Bhagat',
        'Telephone: +91 22 4069 1953\nE-mail: nsdl.ipo@idbicapital.com',
      ],
      [
        'Motilal Oswal Investment Advisors Limited',
        'Ritu Sharma / Sankita Ajinkya',
        'Telephone: +91 22 7193 4380\nE-mail: nsdl.ipo@motilaloswal.com',
      ],
      [
        'SBI Capital Markets Limited',
        'Sylvia Mendonca / Prashant Patankar',
        'Telephone: +91 22 4006 9807\nE-mail: nsdl.ipo@sbicaps.com',
      ],
    ],
  },
  {
    heading: 2,
    text: 'REGISTRAR TO THE OFFER',
  },
  {
    kind: 'table',
    rows: [
      ['NAME OF THE REGISTRAR', 'CONTACT PERSON', 'E-MAIL AND TELEPHONE'],
      [
        'MUFG Intime India Private Limited (Formerly Link Intime India Private Limited)',
        'Shanti Gopalkrishnan',
        'Telephone: +91 810 811 4949\nE-mail: nsdl.ipo@in.mpms.mufg.com',
      ],
    ],
  },
  {
    heading: 2,
    text: 'OUR MANAGEMENT – BOARD OF DIRECTORS AND KEY MANAGERIAL PERSONNEL',
  },
  {
    kind: 'table',
    rows: [
      ['Name', 'Designation', 'DIN'],
      [
        'Vijay Chandok',
        'Managing Director and Chief Executive Officer',
        '00000001',
      ],
      [
        'Alen Wilfred Ferns',
        'Company Secretary and Compliance Officer',
        '00000002',
      ],
      [
        'Shanti Gopalkrishnan',
        'Contact Person, Registrar',
        '00000003',
      ],
    ],
  },
  {
    text: 'Vijay Chandok is the Managing Director and Chief Executive Officer of our Company. Date of Birth: November 28, 1970. He has been associated with the securities market for over two decades.',
  },
  {
    text: 'Alen Wilfred Ferns is the Company Secretary and Compliance Officer of our Company. Contact Person: Alen Wilfred Ferns. Date of Birth: March 15, 1982.',
  },
  {
    text: 'Registered Office: 301, 3rd Floor, Naman Chambers, G-Block, Plot No. C-32, Bandra Kurla Complex, Bandra East, Mumbai – 400 051, Maharashtra, India. Corporate Identity Number: U74120MH2012PLC230380.',
  },
  {
    text: 'Our Company was incorporated on April 27, 2012, as NSDL Depository Limited at Mumbai. Subsequent to the Scheme of Arrangement, the name was changed to National Securities Depository Limited.',
  },
  {
    text: 'IDBI Bank Limited and State Bank of India are participating as Selling Shareholders in the Offer. HDFC Bank Limited is participating as a Selling Shareholder in the Offer.',
  },
  {
    text: 'There have been no financing arrangements whereby our Directors and their relatives have financed the purchase of securities. For details of our Public Interest Directors, refer to Our Management – Board of Directors.',
  },
  {
    text: 'Samar Banwat was appointed as interim in-charge of our Company. Vijay Chandok was appointed as Managing Director and Chief Executive Officer for a period of five years effective from November 28, 2024.',
  },
];

function loadRhpParagraphs() {
  const candidates = [
    RHP_TEXT,
    path.join(ROOT, 'data', 'rhp-source.txt'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf8');
      const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 20 && l.length < 500);
      return lines.slice(0, 800);
    }
  }
  return [];
}

function paragraph(text, heading = null) {
  const options = {
    children: [new TextRun(text)],
  };
  if (heading === 1) options.heading = HeadingLevel.HEADING_1;
  if (heading === 2) options.heading = HeadingLevel.HEADING_2;
  return new Paragraph(options);
}

function table(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: cell.split('\n').map((line, i, arr) => {
                      const runs = [new TextRun(line)];
                      if (i < arr.length - 1) runs.push(new TextRun({ break: 1 }));
                      return runs;
                    }).flat(),
                  }),
                ],
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

async function main() {
  const children = [];

  for (const section of FALLBACK_SECTIONS) {
    if (section.kind === 'table') {
      children.push(table(section.rows));
    } else {
      children.push(paragraph(section.text, section.heading ?? null));
    }
  }

  const extraParagraphs = loadRhpParagraphs();
  for (const line of extraParagraphs) {
    children.push(paragraph(line));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  const outPath = path.join(ROOT, 'input', 'prospectus.docx');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);

  console.log(`Built source document: ${outPath}`);
  console.log(`  Structured sections: ${FALLBACK_SECTIONS.length}`);
  console.log(`  Additional paragraphs: ${extraParagraphs.length}`);
  console.log(`  Total blocks: ${children.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

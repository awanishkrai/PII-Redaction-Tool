import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findSpan(text, value, type) {
  const start = text.indexOf(value);
  if (start === -1) throw new Error(`Not found: ${value}`);
  return { start, end: start + value.length, type, value };
}

const mixed =
  '[SYNTHETIC TEST DATA] Payroll record SSN 123-45-6789 and backup SSN 987-65-4321 on file. Valid Visa test card 4111111111111111 and Mastercard 5555 5555 5555 4444 were used in sandbox. DR server 192.168.10.45 and VAPT host 10.20.30.40 logged during drill. Date of Birth: January 14, 1985 appears in this synthetic KYC line. The board meeting was held on January 14, 2025 with no DOB cue nearby. Reference number 1234567890123456 is sixteen digits but fails Luhn and must NOT be flagged as a credit card. DIN 00012345 is a director ID, not an SSN.';

const bornOn =
  '[SYNTHETIC TEST DATA] Promoter profile: born on 22/08/1978 in Pune. IPO opened on 22/08/2025.';

const ssnOnly =
  '[SYNTHETIC TEST DATA] US subsidiary filing reference SSN 456-78-9012 attached for compliance review.';

const supplement = {
  description:
    'SYNTHETIC SUPPLEMENT — fabricated test data only. Used for SSN, credit card, IP, and DOB precision/recall tests absent from the real RHP. Never blended with real-document metrics.',
  label: 'SYNTHETIC_SUPPLEMENT',
  annotatedAt: new Date().toISOString(),
  samples: [
    {
      id: 'synthetic-mixed-paragraph',
      section: 'Synthetic — planted PII with edge cases',
      text: mixed,
      annotations: [
        findSpan(mixed, '123-45-6789', 'ssn'),
        findSpan(mixed, '987-65-4321', 'ssn'),
        findSpan(mixed, '4111111111111111', 'credit_card'),
        findSpan(mixed, '5555 5555 5555 4444', 'credit_card'),
        findSpan(mixed, '192.168.10.45', 'ip_address'),
        findSpan(mixed, '10.20.30.40', 'ip_address'),
        findSpan(mixed, 'January 14, 1985', 'date_of_birth'),
      ],
      negative_controls: [
        { value: 'January 14, 2025', reason: 'bare filing date — no DOB cue within window' },
        { value: '1234567890123456', reason: '16-digit reference — fails Luhn' },
        { value: '00012345', reason: 'DIN-style number — not SSN format' },
      ],
    },
    {
      id: 'synthetic-ssn-only',
      section: 'Synthetic — SSN isolation',
      text: ssnOnly,
      annotations: [findSpan(ssnOnly, '456-78-9012', 'ssn')],
    },
    {
      id: 'synthetic-born-on',
      section: 'Synthetic — DOB via born on cue',
      text: bornOn,
      annotations: [findSpan(bornOn, '22/08/1978', 'date_of_birth')],
      negative_controls: [{ value: '22/08/2025', reason: 'offer date — no DOB cue' }],
    },
  ],
};

fs.writeFileSync(path.join(__dirname, 'synthetic-supplement.json'), JSON.stringify(supplement, null, 2));
console.log('Rewrote synthetic-supplement.json with verified offsets');

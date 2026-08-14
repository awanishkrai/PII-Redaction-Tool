import nlp from 'compromise';
import { BaseDetector } from './BaseDetector.js';

// Specific list of orgs from the filing we don't want to miss
const ENTITIES = [
  'National Securities Depository Limited',
  'NSDL Depository Limited',
  'ICICI Securities Limited',
  'Axis Capital Limited',
  'HSBC Securities and Capital Markets (India) Private Limited',
  'IDBI Capital Markets & Securities Limited',
  'Motilal Oswal Investment Advisors Limited',
  'SBI Capital Markets Limited',
  'MUFG Intime India Private Limited',
  'Link Intime India Private Limited',
  'IDBI Bank Limited',
  'State Bank of India',
  'HDFC Bank Limited',
  'National Stock Exchange of India Limited',
  'BSE Limited',
  'Securities and Exchange Board of India',
  'Motilal & Associates LLP',
  'Union Bank of India',
  'Administrator of the Specified Undertaking of the Unit Trust of India',
  'Registrar of Companies',
  'Book Running Lead Managers',
];

// words that commonly get flagged by NLP but aren't the orgs we care about
const FP_ORGS = new Set([
  'Offer',
  'Company',
  'Board',
  'India',
  'Mumbai',
  'Maharashtra',
]);

function checkOrg(val) {
  const t = val.trim();
  if (t.length < 4) return false;
  if (FP_ORGS.has(t)) return false;
  return /[A-Z]/.test(t) && /\b(Limited|Ltd|LLP|Private|Bank|Exchange|Depository|Corporation|Company|Associates)\b/i.test(t);
}

export class CompanyDetector extends BaseDetector {
  constructor() {
    super('company', 55);
  }

  detect(text) {
    const hits = [];
    const seen = new Set();

    const pushOrg = (val, from = 0) => {
      const t = val.trim();
      if (!checkOrg(t)) return;
      const idx = text.indexOf(t, from);
      if (idx === -1) return;
      const k = `${idx}:${t.toLowerCase()}`;
      if (seen.has(k)) return;
      seen.add(k);
      hits.push({
        start: idx,
        end: idx + t.length,
        type: this.type,
        value: t,
      });
    };

    // pass 1: strict known-entity sweep
    for (const ent of ENTITIES) {
      let scan = 0;
      while (true) {
        const idx = text.indexOf(ent, scan);
        if (idx === -1) break;
        const k = `${idx}:${ent.toLowerCase()}`;
        if (!seen.has(k)) {
          seen.add(k);
          hits.push({
            start: idx,
            end: idx + ent.length,
            type: this.type,
            value: ent,
            meta: { src: 'list' },
          });
        }
        scan = idx + 1;
      }
    }

    // pass 2: compromise NLP
    const doc = nlp(text);
    const orgs = doc.organizations().json();
    for (const o of orgs) {
      pushOrg(o.text, Math.max(0, o.offset?.start ?? 0));
    }

    return hits.sort((a, b) => a.start - b.start);
  }
}

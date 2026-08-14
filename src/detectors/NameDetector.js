import nlp from 'compromise';
import { BaseDetector } from './BaseDetector.js';

// patterns to catch names based on adjacent honorifics/titles
const CUES = [
  /\bMr\.?\s+/gi,
  /\bMs\.?\s+/gi,
  /\bMrs\.?\s+/gi,
  /\bDr\.?\s+/gi,
  /\bShri\.?\s+/gi,
  /\bSmt\.?\s+/gi,
  /\bDirector\b/gi,
  /\bPromoter\b/gi,
  /\bCompany Secretary\b/gi,
  /\bManaging Director\b/gi,
  /\bChief Executive Officer\b/gi,
  /\bCompliance Officer\b/gi,
  /\bContact Person\b/gi,
  /\bKey Managerial Personnel\b/gi,
];

const AFTER_TITLE = /(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Shri\.?|Smt\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g;
const BEFORE_ROLE = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:Managing Director|Chief Executive Officer|Company Secretary|Compliance Officer|Director)/g;
const APPOINTED = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+was\s+appointed/g;
const SLASH_PAIR = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\/\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;

const IGNORE_LIST = new Set([
  'Red Herring',
  'Book Built',
  'Offer Price',
  'Floor Price',
  'Cap Price',
  'Equity Shares',
  'Public Interest',
  'National Stock',
  'Securities Depository',
  'Bandra Kurla',
  'Plot No',
  'New Delhi',
  'Mumbai Maharashtra',
]);

export function isLikelyName(val) {
  const t = val.trim();
  if (t.length < 4) return false;
  if (IGNORE_LIST.has(t)) return false;
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(t)) {
    return false;
  }
  const chunks = t.split(/\s+/);
  if (chunks.length < 2) return false;
  return chunks.every((c) => /^[A-Z][a-z]+(?:'[a-z]+)?$/.test(c));
}

function pushName(arr, seen, start, end, val, layer) {
  const t = val.trim();
  if (!isLikelyName(t)) return;
  const k = `${start}:${t.toLowerCase()}`;
  if (seen.has(k)) return;
  seen.add(k);
  arr.push({ start, end, type: 'name', value: t, meta: { layer } });
}

export class NameDetector extends BaseDetector {
  constructor() {
    super('name', 60);
  }

  detectCompromise(text) {
    const hits = [];
    const seen = new Set();
    const doc = nlp(text);
    
    for (const p of doc.people().json()) {
      const val = p.text;
      if (!isLikelyName(val)) continue;
      const idx = text.indexOf(val, Math.max(0, p.offset?.start ?? 0));
      if (idx === -1) continue;
      pushName(hits, seen, idx, idx + val.length, val, 'compromise');
    }

    return hits;
  }

  detectHeuristic(text) {
    const hits = [];
    const seen = new Set();

    for (const m of text.matchAll(AFTER_TITLE)) {
      pushName(hits, seen, m.index, m.index + m[0].length, m[0], 'heuristic');
    }

    for (const m of text.matchAll(BEFORE_ROLE)) {
      pushName(hits, seen, m.index, m.index + m[1].length, m[1], 'heuristic');
    }

    for (const m of text.matchAll(SLASH_PAIR)) {
      pushName(hits, seen, m.index, m.index + m[1].length, m[1], 'heuristic');
      const start2 = m.index + m[0].indexOf(m[2]);
      pushName(hits, seen, start2, start2 + m[2].length, m[2], 'heuristic');
    }

    for (const m of text.matchAll(APPOINTED)) {
      pushName(hits, seen, m.index, m.index + m[1].length, m[1], 'heuristic');
    }

    for (const cue of CUES) {
      cue.lastIndex = 0;
      for (const m of text.matchAll(cue)) {
        const start = m.index + m[0].length;
        const chunk = text.slice(start, start + 80);
        const name = chunk.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
        if (name) {
          pushName(hits, seen, start, start + name[1].length, name[1], 'heuristic');
        }
      }
    }

    return hits;
  }

  detect(text) {
    const nlpNames = this.detectCompromise(text);
    const regexNames = this.detectHeuristic(text);
    const seen = new Set();
    const final = [];

    for (const n of [...nlpNames, ...regexNames]) {
      const k = `${n.start}:${n.value.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      final.push(n);
    }

    return final;
  }
}

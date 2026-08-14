import { BaseDetector } from './BaseDetector.js';

// Only flag dates that appear near a DOB cue — RHP docs are full of
// filing/timeline dates we don't want to redact.
// Cue window is deliberately tight at 60 chars.

const CUES = ['dob', 'date of birth', 'born on', 'birth date', 'birthday'];

const DATE_RES = [
  // "28 November 1970" or "28-Nov-1970"
  /\b\d{1,2}[\s/-](?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s/-]\d{2,4}\b/gi,
  // "November 28, 1970"
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s]+\d{1,2},?\s+\d{4}\b/gi,
  // numeric dd/mm/yyyy or dd-mm-yyyy
  /\b\d{1,2}[\s/-]\d{1,2}[\s/-]\d{2,4}\b/g,
];

const WINDOW = 60;

export class DobDetector extends BaseDetector {
  constructor() {
    super('date_of_birth', 75);
  }

  detect(text) {
    const lower = text.toLowerCase();

    // collect all cue positions first
    const cuePos = [];
    for (const cue of CUES) {
      let i = lower.indexOf(cue);
      while (i !== -1) {
        cuePos.push({ start: i, end: i + cue.length });
        i = lower.indexOf(cue, i + 1);
      }
    }
    if (cuePos.length === 0) return [];

    const results = [];
    const seen = new Set();

    for (const re of DATE_RES) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const ds = m.index;
        const de = ds + m[0].length;

        const nearby = cuePos.some((c) => {
          const gap = Math.min(
            Math.abs(ds - c.end),
            Math.abs(de - c.start),
            ds >= c.start && de <= c.end + WINDOW ? 0 : Infinity,
            ds >= c.start - WINDOW && de <= c.end ? 0 : Infinity
          );
          return gap <= WINDOW;
        });

        if (!nearby) continue;
        const key = `${ds}:${m[0]}`;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({ start: ds, end: de, type: this.type, value: m[0] });
      }
    }

    return results;
  }
}

import { BaseDetector } from './BaseDetector.js';

// Indian numbers always start +91, but also catch 10-digit generic formats
// The slash variant handles lines like "+91 22 6944 8500/8400" (dual ext)
const PHONE_RES = [
  /\+91[\s-]?\d{2}[\s-]?\d{4}[\s-]?\d{4,6}(?:\/\d{4})?/g,
  /\+91[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}/g,
  /\+91[\s-]?\d{10}/g,
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
];

export class PhoneDetector extends BaseDetector {
  constructor() {
    super('phone', 85);
  }

  detect(text) {
    const out = [];
    const seen = new Set();

    for (const re of PHONE_RES) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const val = m[0].trim();
        // strip extension before digit-length check
        const digits = val.split('/')[0].replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 13) continue;

        const key = `${m.index}:${val}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({ start: m.index, end: m.index + m[0].length, type: this.type, value: val });
      }
    }

    return out;
  }
}

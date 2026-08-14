import { BaseDetector } from './BaseDetector.js';

// SSN format: 123-45-6789
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

export class SsnDetector extends BaseDetector {
  constructor() {
    super('ssn', 87);
  }

  detect(text) {
    const found = [];
    for (const m of text.matchAll(SSN_RE)) {
      found.push({ start: m.index, end: m.index + m[0].length, type: this.type, value: m[0] });
    }
    return found;
  }
}

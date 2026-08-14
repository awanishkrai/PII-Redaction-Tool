import { BaseDetector } from './BaseDetector.js';

const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;

export class EmailDetector extends BaseDetector {
  constructor() {
    super('email', 90);
  }

  detect(text) {
    const matches = [];
    for (const m of text.matchAll(EMAIL_RE)) {
      matches.push({ start: m.index, end: m.index + m[0].length, type: this.type, value: m[0] });
    }
    return matches;
  }
}

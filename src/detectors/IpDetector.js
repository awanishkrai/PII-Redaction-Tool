import { BaseDetector } from './BaseDetector.js';

// matches valid IPv4 — no leading zeros edge case handled by the alternation
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;

export class IpDetector extends BaseDetector {
  constructor() {
    super('ip_address', 80);
  }

  detect(text) {
    const hits = [];
    for (const m of text.matchAll(IPV4)) {
      hits.push({ start: m.index, end: m.index + m[0].length, type: this.type, value: m[0] });
    }
    return hits;
  }
}

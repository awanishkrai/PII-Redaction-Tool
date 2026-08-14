import { BaseDetector } from './BaseDetector.js';

// MCA21 CIN format: U74120MH2012PLC230380
// Starts with U or L, then 5 digits, 2-letter state, 4-digit year, entity type, 6-digit seq
const CIN_PATTERN = /\b[UL]\d{5}[A-Z]{2}\d{4}(?:PLC|PTC|FTC|GAP|GAT|GOI|NPL|SPL|GSP|OPC)\d{6}\b/g;

export class CinDetector extends BaseDetector {
  constructor() {
    super('cin', 82);
  }

  detect(text) {
    const results = [];
    for (const m of text.matchAll(CIN_PATTERN)) {
      results.push({
        start: m.index,
        end: m.index + m[0].length,
        type: this.type,
        value: m[0],
      });
    }
    return results;
  }
}

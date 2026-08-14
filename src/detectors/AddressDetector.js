import { BaseDetector } from './BaseDetector.js';

// Indian PIN codes
const PIN_RE = /\b\d{3}\s?\d{3}\b/g;

const CUES = [
  'registered office',
  'corporate office',
  'registrar',
  'contact address',
  'office address',
  'registered address',
  'floor',
  'plot',
  'chambers',
  'complex',
  'mumbai',
  'maharashtra',
  'delhi',
  'bengaluru',
  'bangalore',
  'india',
];

const SCAN_RADIUS = 250;

function hasAddressCues(text) {
  const lowered = text.toLowerCase();
  return CUES.some((c) => lowered.includes(c));
}

export class AddressDetector extends BaseDetector {
  constructor() {
    super('address', 70);
  }

  detect(text) {
    const addresses = [];
    const seen = new Set();

    for (const m of text.matchAll(PIN_RE)) {
      const pin = m[0];
      const pStart = m.index;
      const pEnd = pStart + pin.length;

      // grab surrounding context
      const left = Math.max(0, pStart - SCAN_RADIUS);
      const right = Math.min(text.length, pEnd + 40);
      const chunk = text.slice(left, right);

      if (!hasAddressCues(chunk)) continue;

      // try to find the start of the address by looking backward for sentence breaks
      const sep = Math.max(
        text.lastIndexOf('.', pStart - 1),
        text.lastIndexOf(':', pStart - 1),
        text.lastIndexOf('|', pStart - 1),
        text.lastIndexOf('\n', pStart - 1)
      );

      const blockStart = Math.max(left, sep + 1);
      
      // look forward for the end of the address
      let blockEnd = text.indexOf('\n', pEnd);
      if (blockEnd === -1 || blockEnd > pEnd + 80) {
        // fallback to comma or "India"
        const comma = text.indexOf(',', pEnd + 20);
        blockEnd = comma !== -1 && comma < pEnd + 60 ? comma + 1 : pEnd + 40;
        const india = text.indexOf('India', pEnd);
        if (india !== -1 && india < pEnd + 80) {
          blockEnd = india + 5;
        }
      }

      const val = text.slice(blockStart, blockEnd).trim();
      if (val.length < 15) continue;
      
      // ensure the pin is actually in our extracted block
      if (!val.includes(pin.trim()) && !val.includes(pin.replace(/\s/g, ''))) continue;

      const k = `${blockStart}:${val}`;
      if (seen.has(k)) continue;
      seen.add(k);

      addresses.push({
        start: blockStart,
        end: blockEnd,
        type: this.type,
        value: val,
        meta: { pin },
      });
    }

    return addresses;
  }
}

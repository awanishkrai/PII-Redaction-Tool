import { BaseDetector } from './BaseDetector.js';

// standard Luhn check — doubles every other digit from the right
function luhn(digits) {
  let total = 0;
  let flip = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (flip) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    total += n;
    flip = !flip;
  }
  return total % 10 === 0;
}

// catches both spaced (4444 3333 2222 1111) and unspaced (4444333322221111) formats
const CARD_RE = /\b(?:\d{4}[\s-]?){3}\d{4}\b|\b\d{13,19}\b/g;

export class CreditCardDetector extends BaseDetector {
  constructor() {
    super('credit_card', 88);
  }

  detect(text) {
    const cards = [];
    for (const m of text.matchAll(CARD_RE)) {
      const digits = m[0].replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) continue;
      if (!luhn(digits)) continue;
      cards.push({ start: m.index, end: m.index + m[0].length, type: this.type, value: m[0] });
    }
    return cards;
  }
}

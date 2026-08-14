import { EmailDetector } from './detectors/EmailDetector.js';
import { PhoneDetector } from './detectors/PhoneDetector.js';
import { IpDetector } from './detectors/IpDetector.js';
import { CreditCardDetector } from './detectors/CreditCardDetector.js';
import { SsnDetector } from './detectors/SsnDetector.js';
import { CinDetector } from './detectors/CinDetector.js';
import { DobDetector } from './detectors/DobDetector.js';
import { NameDetector } from './detectors/NameDetector.js';
import { CompanyDetector } from './detectors/CompanyDetector.js';
import { AddressDetector } from './detectors/AddressDetector.js';

/**
 * Central orchestrator: runs all detectors and resolves overlapping spans
 * by explicit priority (higher wins) then span length (longer wins).
 *
 * Adding a new PII type = implement one new detector class and register it here.
 */
export class Orchestrator {
  constructor(detectors = null) {
    this.detectors =
      detectors ??
      [
        new EmailDetector(),
        new PhoneDetector(),
        new IpDetector(),
        new CreditCardDetector(),
        new SsnDetector(),
        new CinDetector(),
        new DobDetector(),
        new AddressDetector(),
        new CompanyDetector(),
        new NameDetector(),
      ];
  }

  detectAll(text) {
    const allSpans = [];
    for (const detector of this.detectors) {
      const spans = detector.detect(text);
      for (const span of spans) {
        allSpans.push({
          ...span,
          priority: detector.priority,
        });
      }
    }
    return this.resolveOverlaps(allSpans);
  }

  resolveOverlaps(spans) {
    if (spans.length === 0) return [];

    const sorted = [...spans].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.end - b.start - (a.end - a.start);
    });

    const selected = [];

    for (const candidate of sorted) {
      const overlaps = selected.some(
        (existing) =>
          candidate.start < existing.end && candidate.end > existing.start
      );
      if (!overlaps) {
        selected.push(candidate);
      }
    }

    return selected.sort((a, b) => a.start - b.start);
  }
}

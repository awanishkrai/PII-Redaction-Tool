// all detectors extend this — keeps the orchestrator loop simple
export class BaseDetector {
  constructor(type, priority = 50) {
    this.type = type;
    this.priority = priority;
  }

  detect(_text) {
    throw new Error(`${this.constructor.name} must implement detect()`);
  }
}

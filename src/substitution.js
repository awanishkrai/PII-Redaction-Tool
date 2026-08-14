import { fakerEN_IN as faker } from '@faker-js/faker';

const PLACEHOLDER = {
  email: () => faker.internet.email().toLowerCase(),
  phone: () => faker.phone.number('+91 ##########'),
  ip_address: () => faker.internet.ip(),
  credit_card: () => {
    const base = faker.finance.creditCardNumber('visa');
    return base.replace(/\d(?=\d{4})/g, 'X');
  },
  ssn: () => `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`,
  cin: () => `U${faker.string.numeric(5)}MH${faker.string.numeric(4)}PLC${faker.string.numeric(6)}`,
  date_of_birth: () => faker.date.birthdate({ min: 25, max: 65, mode: 'age' }).toLocaleDateString('en-IN'),
  name: () => faker.person.fullName(),
  company: () => faker.company.name() + ' Limited',
  address: () =>
    `${faker.location.buildingNumber()}, ${faker.location.street()}, ${faker.location.city()} – ${faker.location.zipCode('######')}, ${faker.location.state()}, India`,
};

export class SubstitutionMap {
  constructor() {
    this.map = new Map();
    this.seed = 42;
    faker.seed(this.seed);
  }

  getReplacement(span) {
    const key = `${span.type}::${span.value}`;
    if (this.map.has(key)) {
      return this.map.get(key);
    }

    const generator = PLACEHOLDER[span.type];
    const replacement = generator ? generator() : `[REDACTED_${span.type.toUpperCase()}]`;
    this.map.set(key, replacement);
    return replacement;
  }

  applyRedactions(text, spans) {
    if (spans.length === 0) return text;

    let result = '';
    let cursor = 0;

    for (const span of spans) {
      result += text.slice(cursor, span.start);
      result += this.getReplacement(span);
      cursor = span.end;
    }

    result += text.slice(cursor);
    return result;
  }

  getMappings() {
    return Object.fromEntries(this.map);
  }
}

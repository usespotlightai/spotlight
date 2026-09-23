import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

type Fields = Readonly<Record<string, unknown>>;

const frozen = <T>(held: T): T => {
  if (held && typeof held === 'object') {
    for (const each of Object.values(held)) {
      frozen(each);
    }

    return Object.freeze(held);
  }

  return held;
};

export class DefinitionDocument {
  private constructor(readonly fields: Fields) {}

  static of(held: unknown): DefinitionDocument {
    if (typeof held !== 'object' || held === null || Array.isArray(held)) {
      throw new InvalidIdentifierError(
        'definition',
        'is a document of named fields',
      );
    }

    return new DefinitionDocument(
      frozen(structuredClone(held) as Record<string, unknown>),
    );
  }

  says(field: string, value: string): boolean {
    return this.fields[field] === value;
  }

  equals(other: DefinitionDocument): boolean {
    return JSON.stringify(this.fields) === JSON.stringify(other.fields);
  }
}

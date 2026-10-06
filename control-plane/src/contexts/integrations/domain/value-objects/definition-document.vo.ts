import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  type JsonValue,
  sameJson,
} from '@shared-kernel/domain/services/json-value';

type Fields = Readonly<Record<string, unknown>>;

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
      deepFrozen(structuredClone(held) as Record<string, unknown>),
    );
  }

  says(field: string, value: string): boolean {
    return this.fields[field] === value;
  }

  equals(other: DefinitionDocument): boolean {
    return sameJson(this.fields as JsonValue, other.fields as JsonValue);
  }
}

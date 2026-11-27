import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isJsonObject,
  type JsonObject,
  sameJson,
} from '@shared-kernel/domain/json-value';

export class DefinitionDocument {
  private constructor(readonly fields: JsonObject) {}

  static of(raw: unknown): DefinitionDocument {
    if (!isJsonObject(raw)) {
      throw new InvalidIdentifierError(
        'definition',
        'is a document of named fields',
      );
    }

    return new DefinitionDocument(deepFrozen(structuredClone(raw)));
  }

  hasValue(field: string, value: string): boolean {
    return this.fields[field] === value;
  }

  equals(other: DefinitionDocument): boolean {
    return sameJson(this.fields, other.fields);
  }
}

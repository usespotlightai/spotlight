import { InvalidRunOrderError } from '@runs/domain/exceptions/invalid-run-order.error';
import { RUN_WIRE_FIELDS } from '@runs/domain/value-objects/run-spec.vo';
import {
  isJsonObject,
  isJsonValue,
  type JsonObject,
  type JsonValue,
} from '@shared-kernel/domain/json-value';

const NAME = /^[a-z][a-zA-Z0-9]*$/;

export class RunExtensions {
  private constructor(private readonly blocks: JsonObject) {}

  static none(): RunExtensions {
    return new RunExtensions({});
  }

  static of(raw: Readonly<Record<string, JsonValue>>): RunExtensions {
    if (!isJsonObject(raw) || !isJsonValue(raw)) {
      throw new InvalidRunOrderError('must carry extensions as JSON blocks');
    }

    for (const name of Object.keys(raw)) {
      if (!NAME.test(name)) {
        throw new InvalidRunOrderError(
          `must name each extension in camelCase, not ${JSON.stringify(name)}`,
        );
      }

      if ((RUN_WIRE_FIELDS as readonly string[]).includes(name)) {
        throw new InvalidRunOrderError(
          `must not name an extension ${name}, a field of the run itself`,
        );
      }
    }

    return new RunExtensions(structuredClone(raw) as JsonObject);
  }

  get isEmpty(): boolean {
    return Object.keys(this.blocks).length === 0;
  }

  get value(): JsonObject {
    return structuredClone(this.blocks) as JsonObject;
  }
}

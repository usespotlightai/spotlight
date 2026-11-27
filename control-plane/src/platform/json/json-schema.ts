import {
  isJsonObject,
  type JsonObject,
} from '@shared-kernel/domain/json-value';
import { z } from 'zod';

/** A zod schema with the JSON Schema that describes it, constraints included, for a harness to read and match. */
export class JsonSchema<T> {
  readonly json: JsonObject;

  constructor(
    readonly name: string,
    readonly schema: z.ZodType<T>,
  ) {
    const json: unknown = z.toJSONSchema(schema);

    if (!isJsonObject(json)) {
      throw new Error(`The JSON Schema of ${name} is not an object`);
    }

    this.json = json;
  }
}

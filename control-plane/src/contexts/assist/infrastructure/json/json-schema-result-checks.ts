import type {
  ResultCheck,
  ResultChecksPort,
} from '@assist/application/ports/result-checks.port';
import type { JsonObject } from '@shared-kernel/domain/json-value';
import { z } from 'zod';

export class JsonSchemaResultChecks implements ResultChecksPort {
  check(schema: JsonObject, result: unknown): ResultCheck {
    const parsed = z.fromJSONSchema(schema).safeParse(result);

    return parsed.success
      ? { fits: true, result: parsed.data }
      : {
          fits: false,
          issues: parsed.error.issues.map(({ path, message }) => ({
            path,
            message,
          })),
        };
  }
}

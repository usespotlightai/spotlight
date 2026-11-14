import type {
  InferenceEndpointDefinitionsPort,
  ParsedInferenceEndpoint,
} from '@inference/application/ports/inference-endpoint-definitions.port';
import { INFERENCE_ENDPOINT } from '@inference/application/rendering/inference-problems';
import { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import { ModelName } from '@inference/domain/value-objects/model-name.vo';
import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import { z } from 'zod';

const WHOLE = 'is a whole number that changes to rotate the API key';

const endpointSchema = z.object({
  baseUrl: madeBy(BaseUrl.of),
  model: madeBy(ModelName.of),
  supportsReasoningEffort: z
    .boolean({ error: 'is true or false' })
    .default(false),
  apiKeyWo: z
    .string({ error: 'is the API key, as text' })
    .min(1, 'cannot be empty')
    .nullish(),
  apiKeyWoVersion: z
    .number({ error: WHOLE })
    .int(WHOLE)
    .min(0, WHOLE)
    .nullish(),
});

export class InferenceEndpointDefinitions implements InferenceEndpointDefinitionsPort {
  endpoint(input: unknown): ParsedInferenceEndpoint {
    const read = endpointSchema.safeParse(input);

    if (!read.success) {
      return {
        ok: false,
        problems: problemsIn(INFERENCE_ENDPOINT, read.error),
      };
    }

    return {
      ok: true,
      baseUrl: BaseUrl.of(read.data.baseUrl),
      model: ModelName.of(read.data.model),
      supportsReasoningEffort: read.data.supportsReasoningEffort,
      apiKey: read.data.apiKeyWo ?? null,
      apiKeyVersion: read.data.apiKeyWoVersion ?? null,
    };
  }
}

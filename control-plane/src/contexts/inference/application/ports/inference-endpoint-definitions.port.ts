import type { InferenceEndpointDefinition } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const INFERENCE_ENDPOINT_DEFINITIONS = Symbol(
  'INFERENCE_ENDPOINT_DEFINITIONS',
);

export type ParsedInferenceEndpoint =
  | {
      readonly ok: true;
      readonly baseUrl: InferenceEndpointDefinition['baseUrl'];
      readonly model: InferenceEndpointDefinition['model'];
      readonly supportsReasoningEffort: boolean;
      readonly apiKey: string | null;
      readonly apiKeyVersion: number | null;
    }
  | {
      readonly ok: false;
      readonly problems: readonly ConfigurationProblem[];
    };

export interface InferenceEndpointDefinitionsPort {
  endpoint(input: unknown): ParsedInferenceEndpoint;
}

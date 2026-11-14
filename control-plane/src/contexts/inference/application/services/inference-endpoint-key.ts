import type { ParsedInferenceEndpoint } from '@inference/application/ports/inference-endpoint-definitions.port';
import type { InferenceEndpointDefinition } from '@inference/domain/aggregates/inference-endpoint.aggregate';

type Compiled = Extract<ParsedInferenceEndpoint, { ok: true }>;

export const definitionOf = (
  compiled: Compiled,
  keptVersion: number | null,
): InferenceEndpointDefinition => ({
  baseUrl: compiled.baseUrl,
  model: compiled.model,
  supportsReasoningEffort: compiled.supportsReasoningEffort,
  apiKeyVersion: compiled.apiKey
    ? (compiled.apiKeyVersion ?? (keptVersion ?? 0) + 1)
    : keptVersion,
});

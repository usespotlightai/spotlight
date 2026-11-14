import type { InferenceEndpointResourceDto } from '@inference/application/dto/inference-endpoint-resource.dto';
import type { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';

export const InferenceEndpointResourceMapper = {
  resource(
    endpoint: InferenceEndpoint,
    slug: string,
  ): InferenceEndpointResourceDto {
    return {
      id: endpoint.id.value,
      version: endpoint.version,
      address: slug,
      workspaceId: endpoint.workspaceId.value,
      baseUrl: endpoint.definition.baseUrl.value,
      model: endpoint.definition.model.value,
      supportsReasoningEffort: endpoint.definition.supportsReasoningEffort,
      apiKeySet: endpoint.hasApiKey,
      apiKeyVersion: endpoint.definition.apiKeyVersion,
      warnings: [],
    };
  },
};

import type { InferenceEndpointResourceDto } from '@inference/application/dto/inference-endpoint-resource.dto';
import type { InferenceEndpointView } from '@inference/application/ports/inference-endpoint-configuration.port';
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
      apiKeySet: endpoint.hasApiKey,
      apiKeyVersion: endpoint.definition.apiKeyVersion,
      warnings: [],
    };
  },

  configured(endpoint: InferenceEndpoint): InferenceEndpointView {
    return {
      id: endpoint.id.value,
      workspaceId: endpoint.workspaceId,
      baseUrl: endpoint.definition.baseUrl.value,
      model: endpoint.definition.model.value,
      apiKeySet: endpoint.hasApiKey,
      apiKeyVersion: endpoint.definition.apiKeyVersion,
    };
  },
};

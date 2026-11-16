import type { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import type { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INFERENCE_ENDPOINTS = Symbol('INFERENCE_ENDPOINTS');

export interface InferenceEndpointRepository {
  add(endpoint: InferenceEndpoint): Promise<void>;

  save(endpoint: InferenceEndpoint): Promise<void>;

  find(id: InferenceEndpointId): Promise<InferenceEndpoint | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<InferenceEndpoint | null>;
}

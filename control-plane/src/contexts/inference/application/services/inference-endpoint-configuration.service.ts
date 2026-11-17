import { InferenceEndpointResourceMapper } from '@inference/application/mappers/inference-endpoint-resource.mapper';
import type {
  InferenceEndpointConfigurationPort,
  InferenceEndpointView,
} from '@inference/application/ports/inference-endpoint-configuration.port';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class InferenceEndpointConfiguration implements InferenceEndpointConfigurationPort {
  constructor(private readonly endpoints: InferenceEndpointRepository) {}

  async in(workspaceId: WorkspaceId): Promise<InferenceEndpointView | null> {
    const found = await this.endpoints.ofWorkspace(workspaceId);

    return found ? InferenceEndpointResourceMapper.configured(found) : null;
  }

  async withId(id: string): Promise<InferenceEndpointView | null> {
    const found = await this.endpoints.find(InferenceEndpointId.of(id));

    return found ? InferenceEndpointResourceMapper.configured(found) : null;
  }
}

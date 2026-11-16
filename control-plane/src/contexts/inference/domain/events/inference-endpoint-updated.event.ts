import type { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class InferenceEndpointUpdated implements ConfigurationChanged {
  readonly kind = 'inference-endpoint.updated';

  constructor(
    readonly inferenceEndpointId: InferenceEndpointId,
    readonly workspaceId: WorkspaceId,
    readonly change: ConfigurationChange,
  ) {}
}

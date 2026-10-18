import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import type { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class EgressUpdated implements ConfigurationChanged {
  readonly kind = 'egress.updated';

  constructor(
    readonly egressId: EgressId,
    readonly workspaceId: WorkspaceId,
    readonly key: EgressKey,
    readonly change: ConfigurationChange,
  ) {}
}

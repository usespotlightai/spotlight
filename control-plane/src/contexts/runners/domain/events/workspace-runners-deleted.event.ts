import type { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceRunnersDeleted implements ConfigurationChanged {
  readonly kind = 'workspace-runners.deleted';

  constructor(
    readonly declarationId: WorkspaceRunnersId,
    readonly workspaceId: WorkspaceId,
    readonly change: ConfigurationChange,
  ) {}
}

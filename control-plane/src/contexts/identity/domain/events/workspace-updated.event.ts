import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceUpdated implements ConfigurationChanged {
  readonly kind = 'workspace.updated';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly name: WorkspaceName,
    readonly change: ConfigurationChange,
  ) {}
}

import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceClosed implements ConfigurationChanged {
  readonly kind = 'workspace.closed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly slug: WorkspaceSlug,
    readonly change: ConfigurationChange,
  ) {}
}

import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TeamUpdated implements ConfigurationChanged {
  readonly kind = 'team.updated';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: TeamKey,
    readonly change: ConfigurationChange,
  ) {}
}

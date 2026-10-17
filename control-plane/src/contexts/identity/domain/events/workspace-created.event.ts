import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceCreated implements ConfigurationChanged {
  readonly kind = 'workspace.created';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly owner: UserId,
    readonly firstTeam: {
      readonly id: TeamId;
      readonly name: TeamName;
    } | null,
    readonly change: ConfigurationChange,
  ) {}
}

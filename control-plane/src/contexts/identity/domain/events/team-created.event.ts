import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type TeamOrigin = 'sign-up' | 'configuration';

export class TeamCreated implements ConfigurationChanged {
  readonly kind = 'team.created';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly openedBy: UserId,
    readonly origin: TeamOrigin,
    readonly change: ConfigurationChange,
  ) {}
}

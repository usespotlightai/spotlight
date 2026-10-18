import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ConfigPullRequestRequested implements ConfigurationChanged {
  readonly kind = 'replays.config-pull-request-requested';

  constructor(
    readonly pullRequestId: ConfigPullRequestId,
    readonly teamId: TeamId,
    readonly generation: number,
    readonly change: ConfigurationChange,
  ) {}
}

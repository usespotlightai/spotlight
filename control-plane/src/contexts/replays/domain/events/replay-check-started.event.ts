import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ReplayCheckStarted implements ConfigurationChanged {
  readonly kind = 'replays.replay-check-started';

  constructor(
    readonly checkId: ReplayCheckId,
    readonly teamId: TeamId,
    readonly change: ConfigurationChange,
  ) {}
}

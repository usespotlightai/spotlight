import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ReplayStarted implements ConfigurationChanged {
  readonly kind = 'replays.replay-started';

  constructor(
    readonly replayId: ReplayId,
    readonly teamId: TeamId,
    readonly change: ConfigurationChange,
  ) {}
}

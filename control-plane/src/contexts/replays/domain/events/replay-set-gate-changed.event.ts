import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ReplaySetGateChanged implements ConfigurationChanged {
  readonly kind = 'replays.replay-set-gate-changed';

  constructor(
    readonly setId: ReplaySetId,
    readonly teamId: TeamId,
    readonly change: ConfigurationChange,
  ) {}
}

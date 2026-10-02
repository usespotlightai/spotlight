import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class SearchStarted implements ConfigurationChanged {
  readonly kind = 'replays.search-started';

  constructor(
    readonly searchId: SearchId,
    readonly teamId: TeamId,
    readonly change: ConfigurationChange,
  ) {}
}

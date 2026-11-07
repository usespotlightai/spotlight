import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SetUsers } from '@replays/domain/value-objects/set-users.vo';

export class SetUsage {
  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly checks: ReplayCheckRepository,
  ) {}

  async of(setId: ReplaySetId): Promise<SetUsers> {
    const search = await this.searches.activeOfSet(setId);

    return SetUsers.of({
      searches: search ? [search] : [],
      replays: await this.replays.ofSet(setId),
      checks: await this.checks.awaitingBaselineOfSet(setId),
    });
  }
}

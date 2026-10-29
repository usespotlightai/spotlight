import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';

export class SetUsage {
  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly checks: ReplayCheckRepository,
  ) {}

  async inUse(setId: ReplaySetId): Promise<boolean> {
    return (
      (await this.searches.activeOfSet(setId)) !== null ||
      (await this.replays.ofSet(setId)).some((each) => each.isInProgress) ||
      (await this.checks.awaitingBaselineOfSet(setId)).length > 0
    );
  }
}

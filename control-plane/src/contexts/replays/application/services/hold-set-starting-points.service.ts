import type { WorkPort } from '@replays/application/ports/work.port';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';

export class HoldSetStartingPoints {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
  ) {}

  async changed(setId: ReplaySetId): Promise<void> {
    const set = await this.sets.find(setId);

    if (!set || set.isAtGoneStation) {
      await this.work.release(ReplaySet.holderOf(setId));
      return;
    }

    await this.work.hold(set.holder, set.workspaceId, set.runs);
  }
}

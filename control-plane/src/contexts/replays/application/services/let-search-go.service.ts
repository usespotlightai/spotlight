import type { WorkPort } from '@replays/application/ports/work.port';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { SearchEnded } from '@replays/domain/events/search-ended.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class LetSearchGo {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly work: WorkPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async ended(event: SearchEnded): Promise<void> {
    if (event.withdrawing) {
      await this.work.withdrawSearch(event.withdrawing);
    }

    for (const replayId of event.stopping) {
      await this.stop(replayId);
    }
  }

  async leftOver(search: Search, replays: readonly Replay[]): Promise<void> {
    if (search.isActive) {
      return;
    }

    for (const replay of replays) {
      if (replay.isDispatching) {
        await this.stop(replay.id);
      }
    }
  }

  private stop(replayId: ReplayId): Promise<void> {
    return this.transaction.run(async () => {
      const replay = await this.replays.find(replayId);

      if (replay?.isDispatching && !replay.stoppedAt) {
        await this.replays.save(
          replay.stopped(
            this.clock.now(),
            Attribution.spotlight(replay.workspaceId),
          ),
        );
      }
    });
  }
}

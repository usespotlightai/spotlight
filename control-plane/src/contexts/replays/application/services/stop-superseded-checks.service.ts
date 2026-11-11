import type { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class StopSupersededChecks {
  constructor(
    private readonly checks: ReplayCheckRepository,
    private readonly replays: ReplayRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async started(event: ReplayCheckStarted): Promise<void> {
    const check = await this.checks.find(event.checkId);
    const pullRequest = check?.reference.pullRequest ?? null;

    if (!check || pullRequest === null) {
      return;
    }

    const ofPullRequest = await this.checks.ofPullRequest(
      check.station.stationId,
      pullRequest,
    );

    for (const earlier of ofPullRequest) {
      if (check.supersedes(earlier)) {
        await this.stop(earlier.replayId);
      }
    }
  }

  private stop(replayId: ReplayId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.find(replayId);

      if (replay?.isStoppable) {
        await this.replays.save(
          replay.stop(
            this.clock.now(),
            ChangeActor.spotlight(replay.workspaceId),
            'superseded',
          ),
        );
      }
    });
  }
}

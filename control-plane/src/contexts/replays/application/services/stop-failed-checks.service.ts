import type { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import type { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class StopFailedChecks {
  constructor(
    private readonly checks: ReplayCheckRepository,
    private readonly replays: ReplayRepository,
    private readonly evaluations: CheckEvaluations,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  concluded(event: ReplayEntryConcluded): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.find(event.replayId);
      const check = (await this.checks.ofSet(event.setId)).find(
        (each) => each.replayId?.equals(event.replayId) ?? false,
      );

      if (!replay?.isStoppable || !check) {
        return;
      }

      const { evaluation } = await this.evaluations.of(check);

      if (check.stopsItsReplayOn(evaluation.result)) {
        await this.replays.save(
          replay.stop(
            this.clock.now(),
            ChangeActor.spotlight(replay.workspaceId),
            'check-failed',
          ),
        );
      }
    });
  }
}

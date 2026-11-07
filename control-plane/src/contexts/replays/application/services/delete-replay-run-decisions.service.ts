import type { CancelReplayRuns } from '@replays/application/services/cancel-replay-runs.service';
import type { ReplayDeleted } from '@replays/domain/events/replay-deleted.event';
import type { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteReplayRunDecisions {
  constructor(
    private readonly decisions: ReplayRunDecisionRepository,
    private readonly cancelling: CancelReplayRuns,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    await this.deleteEach(await this.decisions.ofTeam(teamId));
  }

  async ofDeletedReplay(event: ReplayDeleted): Promise<void> {
    await this.cancelling.stopped(event);
    await this.deleteEach(await this.decisions.ofReplay(event.replayId));
  }

  private async deleteEach(
    decisions: readonly ReplayRunDecision[],
  ): Promise<void> {
    for (const decision of decisions) {
      await this.transaction.inTransaction(() =>
        this.decisions.save(decision.delete()),
      );
    }
  }
}

import { removeReplayRunDecision } from '@replays/application/services/replay-run-decision-removal';
import type { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const PURGE_BATCH = 100;

export class DeleteReplayRunDecisions {
  constructor(
    private readonly decisions: ReplayRunDecisionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    await this.deleteEach(await this.decisions.ofTeam(teamId));
  }

  async ofReplay(replayId: ReplayId): Promise<void> {
    await this.deleteEach(await this.decisions.ofReplay(replayId));
  }

  async ofDeletedReplays(decidedBefore: Date): Promise<void> {
    for (;;) {
      const orphaned = await this.decisions.ofDeletedReplays(
        decidedBefore,
        PURGE_BATCH,
      );

      await this.deleteEach(orphaned);

      if (orphaned.length < PURGE_BATCH) {
        return;
      }
    }
  }

  private async deleteEach(
    decisions: readonly ReplayRunDecision[],
  ): Promise<void> {
    for (const decision of decisions) {
      await this.transaction.inTransaction(() =>
        removeReplayRunDecision(this.decisions, decision),
      );
    }
  }
}

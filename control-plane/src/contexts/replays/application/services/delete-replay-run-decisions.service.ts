import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteReplayRunDecisions {
  constructor(
    private readonly decisions: ReplayRunDecisionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const decision of await this.decisions.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.decisions.save(decision.delete()),
      );
    }
  }
}

import { deleteRereadingOnConflict } from '@replays/application/services/delete-rereading-on-conflict';
import { ChangeJudgingVersionConflictError } from '@replays/domain/exceptions/change-judging-version-conflict.error';
import type { ChangeJudgingRepository } from '@replays/domain/repositories/change-judging.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteChangeJudgings {
  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const { runId, attempt } of await this.judgings.ofTeam(teamId)) {
      await deleteRereadingOnConflict(this.transaction, {
        current: () => this.judgings.of(runId, attempt),
        save: (deleted) => this.judgings.save(deleted),
        isConflict: (error) =>
          error instanceof ChangeJudgingVersionConflictError,
      });
    }
  }
}

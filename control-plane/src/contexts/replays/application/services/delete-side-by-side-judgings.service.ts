import { deleteRereadingOnConflict } from '@replays/application/services/delete-rereading-on-conflict';
import { SideBySideJudgingVersionConflictError } from '@replays/domain/exceptions/side-by-side-judging-version-conflict.error';
import type { SideBySideJudgingRepository } from '@replays/domain/repositories/side-by-side-judging.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteSideBySideJudgings {
  constructor(
    private readonly judgings: SideBySideJudgingRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const { runId, otherRunId } of await this.judgings.ofTeam(teamId)) {
      await deleteRereadingOnConflict(this.transaction, {
        current: () => this.judgings.of(runId, otherRunId),
        save: (deleted) => this.judgings.save(deleted),
        isConflict: (error) =>
          error instanceof SideBySideJudgingVersionConflictError,
      });
    }
  }
}

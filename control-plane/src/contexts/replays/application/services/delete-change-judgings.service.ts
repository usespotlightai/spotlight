import { ChangeJudgingVersionConflictError } from '@replays/domain/exceptions/change-judging-version-conflict.error';
import type { ChangeJudgingRepository } from '@replays/domain/repositories/change-judging.repository';
import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const ATTEMPTS = 5;

export class DeleteChangeJudgings {
  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const judging of await this.judgings.ofTeam(teamId)) {
      await this.deleted(judging.runId, judging.attempt);
    }
  }

  private async deleted(
    runId: RunId,
    attempt: JudgingAttempt,
    attempts = ATTEMPTS,
  ): Promise<void> {
    try {
      await this.transaction.inTransaction(async () => {
        const current = await this.judgings.of(runId, attempt);

        if (current) {
          await this.judgings.save(current.delete());
        }
      });
    } catch (error) {
      if (attempts > 1 && error instanceof ChangeJudgingVersionConflictError) {
        return this.deleted(runId, attempt, attempts - 1);
      }

      throw error;
    }
  }
}

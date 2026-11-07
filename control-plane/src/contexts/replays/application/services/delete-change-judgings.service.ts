import type { ChangeJudgingRepository } from '@replays/domain/repositories/change-judging.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteChangeJudgings {
  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const judging of await this.judgings.ofTeam(teamId)) {
      await this.transaction.inTransaction(() => this.judgings.remove(judging));
    }
  }
}

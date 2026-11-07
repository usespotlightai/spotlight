import type { SideBySideJudgingRepository } from '@replays/domain/repositories/side-by-side-judging.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteSideBySideJudgings {
  constructor(
    private readonly judgings: SideBySideJudgingRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const judging of await this.judgings.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.judgings.save(judging.delete()),
      );
    }
  }
}

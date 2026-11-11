import type { LineSearchBudgetRepository } from '@replays/domain/repositories/line-search-budget.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteLineSearchBudgets {
  constructor(
    private readonly budgets: LineSearchBudgetRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const budget of await this.budgets.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.budgets.save(budget.delete()),
      );
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { LineSearchBudget } from '@replays/domain/aggregates/line-search-budget.aggregate';
import { LineSearchBudgetVersionConflictError } from '@replays/domain/exceptions/line-search-budget-version-conflict.error';
import type { LineSearchBudgetRepository } from '@replays/domain/repositories/line-search-budget.repository';
import { Money } from '@replays/domain/value-objects/money.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { lineSearchBudget } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

type BudgetRow = typeof lineSearchBudget.$inferSelect;

const toBudget = (row: BudgetRow): LineSearchBudget =>
  LineSearchBudget.rehydrate({
    lineId: LineId.of(row.lineId),
    month: row.month,
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    admissions: row.admissions.map((each) => ({
      searchId: SearchId.of(each.searchId),
      ceiling: Money.of(each.amount, each.currency),
    })),
    version: row.version,
  });

const admissionsOf = (budget: LineSearchBudget) =>
  budget.admissions.map((each) => ({
    searchId: each.searchId.value,
    amount: each.ceiling.amount,
    currency: each.ceiling.currency,
  }));

@Injectable()
export class DrizzleLineSearchBudgetRepository
  implements LineSearchBudgetRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async locked(lineId: LineId, month: Date): Promise<LineSearchBudget | null> {
    const [found] = await this.context.db
      .select()
      .from(lineSearchBudget)
      .where(
        and(
          eq(lineSearchBudget.lineId, lineId.value),
          eq(lineSearchBudget.month, month),
        ),
      )
      .for('update');

    return found ? toBudget(found) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly LineSearchBudget[]> {
    return (
      await this.context.db
        .select()
        .from(lineSearchBudget)
        .where(eq(lineSearchBudget.teamId, teamId.value))
    ).map(toBudget);
  }

  async add(added: LineSearchBudget): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(lineSearchBudget)
        .values({
          lineId: added.lineId.value,
          month: added.month,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          admissions: admissionsOf(added),
          version: added.version,
        })
        .onConflictDoNothing()
        .returning({ lineId: lineSearchBudget.lineId });

      if (written.length === 0) {
        throw new LineSearchBudgetVersionConflictError(added.lineId);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: LineSearchBudget): Promise<void> {
    await this.context.inTransaction(async () => {
      const at = and(
        eq(lineSearchBudget.lineId, saved.lineId.value),
        eq(lineSearchBudget.month, saved.month),
        eq(lineSearchBudget.version, saved.version),
      ) as SQL;
      const written = saved.isDeleted
        ? await this.context.db
            .delete(lineSearchBudget)
            .where(at)
            .returning({ lineId: lineSearchBudget.lineId })
        : await this.context.db
            .update(lineSearchBudget)
            .set({
              admissions: admissionsOf(saved),
              version: saved.version + 1,
            })
            .where(at)
            .returning({ lineId: lineSearchBudget.lineId });

      if (written.length === 0) {
        throw new LineSearchBudgetVersionConflictError(saved.lineId);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }
}

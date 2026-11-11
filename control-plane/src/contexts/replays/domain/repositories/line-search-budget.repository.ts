import type { LineSearchBudget } from '@replays/domain/aggregates/line-search-budget.aggregate';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface LineSearchBudgetRepository {
  locked(lineId: LineId, month: Date): Promise<LineSearchBudget | null>;

  ofTeam(teamId: TeamId): Promise<readonly LineSearchBudget[]>;

  add(budget: LineSearchBudget): Promise<void>;

  save(budget: LineSearchBudget): Promise<void>;
}

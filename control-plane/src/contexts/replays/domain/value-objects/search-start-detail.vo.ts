import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class SearchStartDetail implements ChangeDetail {
  private constructor(
    readonly setId: string,
    readonly stationId: string,
    readonly harness: string | null,
    readonly model: string | null,
    readonly effort: string | null,
    readonly iterations: number,
    readonly perIteration: number,
    readonly concurrency: number,
    readonly ceiling: string,
    readonly heldOutTasks: number,
    readonly repeats: number,
    readonly objective: SearchObjective,
  ) {}

  static of(input: {
    setId: ReplaySetId;
    stationId: string;
    agent: SearchAgent | null;
    budget: SearchBudget;
    objective: SearchObjective;
    heldOutTasks: number;
  }): SearchStartDetail {
    return new SearchStartDetail(
      input.setId.value,
      input.stationId,
      input.agent?.harness ?? null,
      input.agent?.model ?? null,
      input.agent?.effort ?? null,
      input.budget.iterations,
      input.budget.perIteration,
      input.budget.concurrency,
      `${input.budget.ceiling.amount} ${input.budget.ceiling.currency}`,
      input.heldOutTasks,
      input.budget.repeats,
      input.objective,
    );
  }

  recorded(): RecordedDetail {
    return {
      set: this.setId,
      station: this.stationId,
      harness: this.harness,
      model: this.model,
      effort: this.effort,
      iterations: this.iterations,
      perIteration: this.perIteration,
      concurrency: this.concurrency,
      ceiling: this.ceiling,
      heldOutTasks: this.heldOutTasks,
      repeats: this.repeats,
      objective: this.objective,
    };
  }
}

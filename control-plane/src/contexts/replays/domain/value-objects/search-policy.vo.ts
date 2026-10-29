import { Money } from '@replays/domain/value-objects/money.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import {
  isSearchObjective,
  type SearchObjective,
} from '@replays/domain/value-objects/search-objective';

export class SearchPolicy {
  private constructor(
    readonly enabled: boolean,
    readonly monthlyCeiling: Money,
    readonly ceiling: Money,
    readonly periodMilliseconds: number,
    readonly onAlert: boolean,
    readonly cooldownMilliseconds: number,
    readonly agent: SearchAgent | null,
    readonly iterations: number | null,
    readonly repeats: number | null,
    readonly objective: SearchObjective | null,
  ) {}

  static of(input: {
    enabled: boolean;
    monthlyCeiling: number;
    currency: string;
    ceiling: number;
    periodMilliseconds: number;
    onAlert: boolean;
    cooldownMilliseconds: number;
    agent: {
      harness: string;
      model: string | null;
      effort: string | null;
    } | null;
    iterations: number | null;
    repeats: number | null;
    objective: string | null;
  }): SearchPolicy {
    return new SearchPolicy(
      input.enabled,
      Money.of(input.monthlyCeiling, input.currency),
      Money.of(input.ceiling, input.currency),
      input.periodMilliseconds,
      input.onAlert,
      input.cooldownMilliseconds,
      input.agent && SearchAgent.of(input.agent),
      input.iterations,
      input.repeats,
      isSearchObjective(input.objective) ? input.objective : null,
    );
  }
}

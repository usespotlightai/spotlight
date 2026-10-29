import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { StationKind } from '@work/domain/entities/station.entity';
import { InvalidSearchIntervalError } from '@work/domain/exceptions/invalid-search-interval.error';
import {
  InvalidSearchPolicyError,
  type SearchPolicyField,
} from '@work/domain/exceptions/invalid-search-policy.error';
import { InvalidSpendCeilingError } from '@work/domain/exceptions/invalid-spend-ceiling.error';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import { SearchInterval } from '@work/domain/value-objects/search-interval.vo';
import {
  SpendCeiling,
  spendAmountProblem,
} from '@work/domain/value-objects/spend-ceiling.vo';

const MAX_SEARCH_ITERATIONS = 10;

const MAX_SEARCH_REPEATS = 5;

export const SEARCH_OBJECTIVES = ['success', 'cost'] as const;

export type SearchObjective = (typeof SEARCH_OBJECTIVES)[number];

const isObjective = (raw: string): raw is SearchObjective =>
  (SEARCH_OBJECTIVES as readonly string[]).includes(raw);

const intervalOf = (field: SearchPolicyField, raw: string): SearchInterval => {
  try {
    return SearchInterval.of(raw);
  } catch (error) {
    if (error instanceof InvalidSearchIntervalError) {
      throw new InvalidSearchPolicyError(field, error.because);
    }
    throw error;
  }
};

const spendOf = (
  field: 'ceiling' | 'monthlyCeiling',
  amount: number,
  currency: string,
  most?: number | null,
): SpendCeiling => {
  try {
    return SpendCeiling.of(amount, currency, most);
  } catch (error) {
    if (error instanceof InvalidSpendCeilingError) {
      throw new InvalidSearchPolicyError(
        error.field === 'amount' ? field : 'currency',
        error.because,
      );
    }
    throw error;
  }
};

const countOf = (
  field: SearchPolicyField,
  value: number,
  max: number,
): number => {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new InvalidSearchPolicyError(
      field,
      `must be a whole number from 1 to ${max}`,
    );
  }

  return value;
};

const optional = <T, R>(
  value: T | null | undefined,
  made: (value: T) => R,
): R | null => (value === null || value === undefined ? null : made(value));

export interface SearchAgentPrimitives {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export class SearchAgent {
  private constructor(
    readonly harness: HarnessId,
    readonly model: HarnessModel | null,
    readonly effort: Effort | null,
  ) {}

  static of(input: {
    harness: HarnessId;
    model?: HarnessModel | null;
    effort?: Effort | null;
  }): SearchAgent {
    return new SearchAgent(
      input.harness,
      input.model ?? null,
      input.effort ?? null,
    );
  }

  toPrimitives(): SearchAgentPrimitives {
    return {
      harness: this.harness.value,
      model: this.model?.value ?? null,
      effort: this.effort?.value ?? null,
    };
  }

  equals(other: SearchAgent): boolean {
    const mine = this.toPrimitives();
    const theirs = other.toPrimitives();

    return (
      mine.harness === theirs.harness &&
      mine.model === theirs.model &&
      mine.effort === theirs.effort
    );
  }
}

export class StationSearchOverride {
  private constructor(
    readonly enabled: boolean | null,
    readonly ceiling: number | null,
    readonly period: SearchInterval | null,
    readonly onAlert: boolean | null,
    readonly cooldown: SearchInterval | null,
    readonly agent: SearchAgent | null,
    readonly iterations: number | null,
    readonly repeats: number | null,
    readonly objective: SearchObjective | null,
  ) {}

  static of(input: {
    enabled?: boolean | null;
    ceiling?: number | null;
    period?: string | null;
    onAlert?: boolean | null;
    cooldown?: string | null;
    agent?: SearchAgent | null;
    iterations?: number | null;
    repeats?: number | null;
    objective?: string | null;
  }): StationSearchOverride {
    const ceiling = optional(input.ceiling, (value) => {
      const problem = spendAmountProblem(value);

      if (problem) {
        throw new InvalidSearchPolicyError('ceiling', problem);
      }

      return value;
    });
    const objective = optional(input.objective, (raw) => {
      if (!isObjective(raw)) {
        throw new InvalidSearchPolicyError(
          'objective',
          `must be one of ${SEARCH_OBJECTIVES.join(', ')}`,
        );
      }

      return raw;
    });

    return new StationSearchOverride(
      input.enabled ?? null,
      ceiling,
      optional(input.period, (raw) => intervalOf('period', raw)),
      input.onAlert ?? null,
      optional(input.cooldown, (raw) => intervalOf('cooldown', raw)),
      input.agent ?? null,
      optional(input.iterations, (value) =>
        countOf('iterations', value, MAX_SEARCH_ITERATIONS),
      ),
      optional(input.repeats, (value) =>
        countOf('repeats', value, MAX_SEARCH_REPEATS),
      ),
      objective,
    );
  }

  equals(other: StationSearchOverride): boolean {
    const same = <T extends { equals(other: T): boolean }>(
      one: T | null,
      another: T | null,
    ): boolean =>
      one === null || another === null ? one === another : one.equals(another);

    return (
      this.enabled === other.enabled &&
      this.ceiling === other.ceiling &&
      same(this.period, other.period) &&
      this.onAlert === other.onAlert &&
      same(this.cooldown, other.cooldown) &&
      same(this.agent, other.agent) &&
      this.iterations === other.iterations &&
      this.repeats === other.repeats &&
      this.objective === other.objective
    );
  }
}

export interface SearchPolicy {
  readonly enabled: boolean;
  readonly monthlyCeiling: SpendCeiling;
  readonly ceiling: SpendCeiling;
  readonly period: SearchInterval;
  readonly onAlert: boolean;
  readonly cooldown: SearchInterval;
  readonly agent: SearchAgent | null;
  readonly iterations: number | null;
  readonly repeats: number | null;
  readonly objective: SearchObjective | null;
}

export interface SearchOverrideProblem {
  readonly field: 'ceiling' | 'cooldown';
  readonly reason: string;
}

export interface LineSearchPrimitives {
  readonly enabled: boolean;
  readonly monthlyCeiling: number;
  readonly currency: string;
  readonly ceiling: number;
  readonly period: string;
  readonly onAlert: boolean;
  readonly cooldown: string;
}

const BY_DEFAULT: LineSearchPrimitives = {
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  period: '7d',
  onAlert: true,
  cooldown: '3d',
};

export class LineSearchPolicy {
  private constructor(
    readonly enabled: boolean,
    readonly monthlyCeiling: SpendCeiling,
    readonly ceiling: SpendCeiling,
    readonly period: SearchInterval,
    readonly onAlert: boolean,
    readonly cooldown: SearchInterval,
  ) {}

  static of(written: Partial<LineSearchPrimitives>): LineSearchPolicy {
    const input: LineSearchPrimitives = {
      ...BY_DEFAULT,
      ...Object.fromEntries(
        Object.entries(written).filter(([, value]) => value !== undefined),
      ),
    };
    const ceiling = spendOf('ceiling', input.ceiling, input.currency);
    const monthlyCeiling = spendOf(
      'monthlyCeiling',
      input.monthlyCeiling,
      input.currency,
      null,
    );
    const period = intervalOf('period', input.period);
    const cooldown = intervalOf('cooldown', input.cooldown);

    if (ceiling.isAbove(monthlyCeiling)) {
      throw new InvalidSearchPolicyError(
        'ceiling',
        `must be at most the monthly_ceiling, ${monthlyCeiling.amount} ${monthlyCeiling.currency}`,
      );
    }
    if (cooldown.isLongerThan(period)) {
      throw new InvalidSearchPolicyError(
        'cooldown',
        `must be at most the period, ${period.text}`,
      );
    }

    return new LineSearchPolicy(
      input.enabled,
      monthlyCeiling,
      ceiling,
      period,
      input.onAlert,
      cooldown,
    );
  }

  static readonly DEFAULT = LineSearchPolicy.of({});

  get currency(): string {
    return this.monthlyCeiling.currency;
  }

  overrideProblem(
    station: StationSearchOverride,
  ): SearchOverrideProblem | null {
    const resolved = this.resolved(station);

    if (resolved.ceiling.isAbove(this.monthlyCeiling)) {
      return {
        field: 'ceiling',
        reason: `search ceiling must be at most the line's monthly_ceiling, ${this.monthlyCeiling.amount} ${this.currency}`,
      };
    }
    if (resolved.cooldown.isLongerThan(resolved.period)) {
      return {
        field: 'cooldown',
        reason: `search cooldown must be at most its period, ${resolved.period.text}`,
      };
    }

    return null;
  }

  resolvedFor(station: {
    readonly kind: StationKind;
    readonly search: StationSearchOverride | null;
  }): SearchPolicy | null {
    return station.kind === 'work' ? this.resolved(station.search) : null;
  }

  toPrimitives(): LineSearchPrimitives {
    return {
      enabled: this.enabled,
      monthlyCeiling: this.monthlyCeiling.amount,
      currency: this.currency,
      ceiling: this.ceiling.amount,
      period: this.period.text,
      onAlert: this.onAlert,
      cooldown: this.cooldown.text,
    };
  }

  equals(other: LineSearchPolicy): boolean {
    return (
      this.enabled === other.enabled &&
      this.monthlyCeiling.equals(other.monthlyCeiling) &&
      this.ceiling.equals(other.ceiling) &&
      this.period.equals(other.period) &&
      this.onAlert === other.onAlert &&
      this.cooldown.equals(other.cooldown)
    );
  }

  private resolved(station: StationSearchOverride | null): SearchPolicy {
    return {
      enabled: station?.enabled ?? this.enabled,
      monthlyCeiling: this.monthlyCeiling,
      ceiling:
        station === null || station.ceiling === null
          ? this.ceiling
          : SpendCeiling.of(station.ceiling, this.currency),
      period: station?.period ?? this.period,
      onAlert: station?.onAlert ?? this.onAlert,
      cooldown: station?.cooldown ?? this.cooldown,
      agent: station?.agent ?? null,
      iterations: station?.iterations ?? null,
      repeats: station?.repeats ?? null,
      objective: station?.objective ?? null,
    };
  }
}

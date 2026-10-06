import { InvalidModelUsageError } from '@shared-kernel/domain/exceptions/invalid-model-usage.error';

export interface ModelCall {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cost: ModelCost | null;
}

export interface ModelCost {
  readonly amount: number;
  readonly currency: string;
}

const counted = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

const CURRENCY = /^[A-Z]{3}$/;

const MICROS = 1_000_000;

const inMicros = (amount: number): number =>
  Math.round(amount * MICROS) / MICROS;

const isCost = (cost: ModelCost): boolean =>
  counted(cost.amount) && CURRENCY.test(cost.currency);

export class ModelUsage {
  private constructor(
    readonly calls: number,
    readonly inputTokens: number,
    readonly outputTokens: number,
    readonly costs: readonly ModelCost[],
    readonly unpriced: number,
  ) {}

  static none(): ModelUsage {
    return new ModelUsage(0, 0, 0, [], 0);
  }

  static rehydrate(input: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costs: readonly ModelCost[];
    unpriced: number;
  }): ModelUsage {
    const currencies = input.costs.map((each) => each.currency);

    if (
      ![
        input.calls,
        input.inputTokens,
        input.outputTokens,
        input.unpriced,
      ].every(counted) ||
      input.unpriced > input.calls ||
      !input.costs.every(isCost) ||
      new Set(currencies).size !== currencies.length
    ) {
      throw new InvalidModelUsageError(
        'must have non-negative amounts, one per currency',
      );
    }

    return new ModelUsage(
      input.calls,
      input.inputTokens,
      input.outputTokens,
      input.costs.map((each) => ({ ...each })),
      input.unpriced,
    );
  }

  with(call: ModelCall | null): ModelUsage {
    if (!call) {
      return this;
    }
    if (call.cost && !isCost(call.cost)) {
      throw new InvalidModelUsageError(
        'must have a non-negative price in a three-letter currency',
      );
    }

    const known = (value: number | null): number =>
      value !== null && counted(value) ? value : 0;

    return new ModelUsage(
      this.calls + 1,
      this.inputTokens + known(call.inputTokens),
      this.outputTokens + known(call.outputTokens),
      call.cost ? this.costing(call.cost) : this.costs,
      this.unpriced + (call.cost === null ? 1 : 0),
    );
  }

  equals(other: ModelUsage): boolean {
    return (
      this.calls === other.calls &&
      this.inputTokens === other.inputTokens &&
      this.outputTokens === other.outputTokens &&
      this.unpriced === other.unpriced &&
      this.costs.length === other.costs.length &&
      this.costs.every((each) =>
        other.costs.some(
          (theirs) =>
            theirs.currency === each.currency && theirs.amount === each.amount,
        ),
      )
    );
  }

  private costing(cost: ModelCost): readonly ModelCost[] {
    const held = this.costs.some((each) => each.currency === cost.currency);

    return held
      ? this.costs.map((each) =>
          each.currency === cost.currency
            ? {
                amount: inMicros(each.amount + cost.amount),
                currency: each.currency,
              }
            : each,
        )
      : [...this.costs, { ...cost }];
  }
}

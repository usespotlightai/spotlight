import type { Money } from '@runs/domain/value-objects/money.vo';

interface AgentSpend {
  readonly spentCosts: readonly Money[];
  readonly unpricedCalls: number;
}

interface Spent {
  readonly costs: readonly Money[];
  readonly unpricedSessions: number;
  readonly called: boolean;
}

export const agentSpendOf = (spent: Spent): AgentSpend => {
  const accounted = spent.costs.length > 0 || spent.unpricedSessions > 0;

  return {
    spentCosts: [...spent.costs],
    unpricedCalls:
      spent.unpricedSessions + (spent.called && !accounted ? 1 : 0),
  };
};

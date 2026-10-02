import { agentSpendOf } from '@work/domain/services/agent-spend';
import { Money } from '@work/domain/value-objects/money.vo';
import { describe, expect, it } from 'vitest';

describe('agentSpendOf', () => {
  it('spends what each session cost in its currency, counts every unpriced session, and nothing for a run that called no model', () => {
    const usd = Money.of(0.42, 'USD');
    const eur = Money.of(0.1, 'EUR');

    expect(
      agentSpendOf({ costs: [usd], unpricedSessions: 0, called: true }),
    ).toEqual({ spentCosts: [usd], unpricedCalls: 0 });
    expect(
      agentSpendOf({ costs: [usd, eur], unpricedSessions: 2, called: true }),
    ).toEqual({ spentCosts: [usd, eur], unpricedCalls: 2 });
    expect(
      agentSpendOf({ costs: [], unpricedSessions: 0, called: false }),
    ).toEqual({ spentCosts: [], unpricedCalls: 0 });
    expect(
      agentSpendOf({ costs: [], unpricedSessions: 0, called: true }),
    ).toEqual({ spentCosts: [], unpricedCalls: 1 });
  });
});

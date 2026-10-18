import type { RunUsage } from '@work/application/ports/run-usage-reader.port';
import { together } from '@work/application/read-models/run-usage';
import { Money } from '@work/domain/value-objects/money.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

describe('together', () => {
  const usage = (cost: Money | null, steps = 1, errors = 0): RunUsage => ({
    ms: null,
    steps,
    errors,
    changedLines: 0,
    contextTokens: null,
    contextWindow: null,
    cost,
    tokens: Tokens.UNREPORTED,
  });

  it('adds up what every run of the task cost', () => {
    const spent = together([
      usage(Money.of(0.25, 'USD'), 4, 1),
      usage(Money.of(0.5, 'USD'), 6, 2),
    ]);

    expect(spent.cost?.amount).toBeCloseTo(0.75);
    expect(spent.steps).toBe(10);
    expect(spent.errors).toBe(3);
  });

  it('says nothing about a cost counted two different ways', () => {
    const spent = together([
      usage(Money.of(1, 'USD'), 2),
      usage(Money.of(1, 'EUR'), 3),
    ]);

    expect(spent.cost).toBeNull();
    expect(spent.steps).toBe(5);
  });

  it('carries a cost through where only one run reported it', () => {
    expect(
      together([usage(null), usage(Money.of(2, 'USD'))]).cost?.amount,
    ).toBe(2);
  });
});

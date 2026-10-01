import type { RunDigest } from '@work/application/ports/run-digest-reader.port';
import { together } from '@work/application/read-models/run-digest';
import { Money } from '@work/domain/value-objects/money.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

describe('together', () => {
  const digest = (cost: Money | null, steps = 1, faults = 0): RunDigest => ({
    ms: null,
    steps,
    faults,
    changedLines: 0,
    used: null,
    size: null,
    cost,
    tokens: Tokens.UNREPORTED,
  });

  it('adds up what every run of the task cost', () => {
    const spent = together([
      digest(Money.of(0.25, 'USD'), 4, 1),
      digest(Money.of(0.5, 'USD'), 6, 2),
    ]);

    expect(spent.cost?.amount).toBeCloseTo(0.75);
    expect(spent.steps).toBe(10);
    expect(spent.faults).toBe(3);
  });

  it('says nothing about a cost counted two different ways', () => {
    const spent = together([
      digest(Money.of(1, 'USD'), 2),
      digest(Money.of(1, 'EUR'), 3),
    ]);

    expect(spent.cost).toBeNull();
    expect(spent.steps).toBe(5);
  });

  it('carries a cost through where only one run reported it', () => {
    expect(
      together([digest(null), digest(Money.of(2, 'USD'))]).cost?.amount,
    ).toBe(2);
  });
});

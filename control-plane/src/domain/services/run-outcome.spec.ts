import { outcomeOf, together } from '@domain/services/run-outcome';
import { Money } from '@domain/value-objects/money.vo';
import { describe, expect, it } from 'vitest';

describe('outcomeOf', () => {
  it('counts a fault for every step that failed, and nothing else', () => {
    const outcome = outcomeOf({
      ms: 4_000,
      statuses: ['completed', 'failed', null, 'running', 'failed'],
      used: 10,
      size: 200,
      cost: Money.of(0.5, 'USD'),
    });

    expect(outcome.steps).toBe(5);
    expect(outcome.faults).toBe(2);
  });

  it('says a run did nothing where its journal held nothing', () => {
    const outcome = outcomeOf({
      ms: null,
      statuses: [],
      used: null,
      size: null,
      cost: null,
    });

    expect(outcome).toEqual({
      ms: null,
      steps: 0,
      faults: 0,
      used: null,
      size: null,
      cost: null,
    });
  });
});

describe('together', () => {
  const outcome = (cost: Money | null, steps = 1, faults = 0) =>
    outcomeOf({
      ms: null,
      statuses: Array(steps)
        .fill('completed')
        .map((s, i) => (i < faults ? 'failed' : s)),
      used: null,
      size: null,
      cost,
    });

  it('adds up what every run of the task cost', () => {
    const spent = together([
      outcome(Money.of(0.25, 'USD'), 4, 1),
      outcome(Money.of(0.5, 'USD'), 6, 2),
    ]);

    expect(spent.cost?.amount).toBeCloseTo(0.75);
    expect(spent.steps).toBe(10);
    expect(spent.faults).toBe(3);
  });

  // A sum of two currencies would say something false, and refusing to answer
  // at all would lose the rest of the reading with it.
  it('says nothing about a cost counted two different ways', () => {
    const spent = together([
      outcome(Money.of(1, 'USD'), 2),
      outcome(Money.of(1, 'EUR'), 3),
    ]);

    expect(spent.cost).toBeNull();
    expect(spent.steps).toBe(5);
  });

  it('carries a cost through where only one run reported it', () => {
    expect(
      together([outcome(null), outcome(Money.of(2, 'USD'))]).cost?.amount,
    ).toBe(2);
  });
});

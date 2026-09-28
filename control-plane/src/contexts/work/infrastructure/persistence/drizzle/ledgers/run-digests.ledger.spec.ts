import { Money } from '@work/domain/value-objects/money.vo';
import { digestOf } from '@work/infrastructure/persistence/drizzle/ledgers/run-digests.ledger';
import { describe, expect, it } from 'vitest';

describe('digestOf', () => {
  it('counts a fault for every step that failed, and nothing else', () => {
    const digest = digestOf({
      ms: 4_000,
      statuses: ['completed', 'failed', null, 'running', 'failed'],
      used: 10,
      size: 200,
      cost: Money.of(0.5, 'USD'),
    });

    expect(digest.steps).toBe(5);
    expect(digest.faults).toBe(2);
  });

  it('says a run did nothing where its journal held nothing', () => {
    const digest = digestOf({
      ms: null,
      statuses: [],
      used: null,
      size: null,
      cost: null,
    });

    expect(digest).toEqual({
      ms: null,
      steps: 0,
      faults: 0,
      used: null,
      size: null,
      cost: null,
    });
  });
});

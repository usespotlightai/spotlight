import {
  type CohortLayering,
  combined,
  layeredConcurrently,
} from '@change-review/application/services/cohort-layering';
import { describe, expect, it } from 'vitest';

const CALL = {
  inputTokens: 10,
  outputTokens: 20,
  cost: { amount: 0.01, currency: 'USD' as const },
};

const layered = (title: string): CohortLayering => ({
  outcome: 'layered',
  cohort: { kind: 'change', title, intent: title, layers: [] },
  usage: [CALL],
});

describe('layeredConcurrently', () => {
  it('layers at most four cohorts at once and keeps their order', async () => {
    let running = 0;
    let most = 0;

    const done = await layeredConcurrently(
      Array.from({ length: 10 }, (_, at) => async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 10 - at));
        running -= 1;
        return layered(`Cohort ${at + 1}`);
      }),
    );

    expect(most).toBe(4);
    expect(
      done.map((each) => each.outcome === 'layered' && each.cohort.title),
    ).toEqual(Array.from({ length: 10 }, (_, at) => `Cohort ${at + 1}`));
  });
});

describe('layeredConcurrently, when a layering crashes', () => {
  it('starts no more layerings', async () => {
    let started = 0;

    await expect(
      layeredConcurrently(
        Array.from({ length: 10 }, (_, at) => async () => {
          started += 1;
          if (at === 0) {
            throw new Error('a bug');
          }
          await new Promise((resolve) => setTimeout(resolve, 5));
          return layered(`Cohort ${at + 1}`);
        }),
      ),
    ).rejects.toThrow('a bug');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(started).toBeLessThanOrEqual(4);
  });
});

describe('combined', () => {
  it('reports a cut-off answer before any other failure, with the usage of every call', () => {
    const result = combined([
      layered('One'),
      { outcome: 'unanswered', truncated: false, error: 'busy', usage: [] },
      { outcome: 'broken', problems: [], usage: [CALL] },
      {
        outcome: 'unanswered',
        truncated: true,
        error: 'length',
        usage: [CALL],
      },
    ]);

    expect(result).toMatchObject({ outcome: 'unanswered', truncated: true });
    expect(result.usage).toHaveLength(3);
  });

  it('collects the problems of every broken cohort', () => {
    const shape = { code: 'shape' as const, message: 'leaves h1 out' };

    expect(
      combined([
        layered('One'),
        { outcome: 'broken', problems: [shape], usage: [] },
      ]),
    ).toMatchObject({ outcome: 'broken', problems: [shape] });
  });
});

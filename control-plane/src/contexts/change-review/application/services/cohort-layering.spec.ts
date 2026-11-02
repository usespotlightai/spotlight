import {
  type CohortLayering,
  combined,
  layeredInRounds,
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

describe('layeredInRounds', () => {
  it('layers at most four cohorts at once, in rounds that each begin with a call to prepare, and keeps their order', async () => {
    const events: string[] = [];
    const rounds: number[] = [];
    let running = 0;
    let most = 0;

    const done = await layeredInRounds(
      Array.from({ length: 10 }, (_, at) => async () => {
        running += 1;
        most = Math.max(most, running);
        events.push(`layer ${at + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 10 - at));
        running -= 1;
        return layered(`Cohort ${at + 1}`);
      }),
      {
        before: async () => {
          events.push('round');
        },
        after: (round) => {
          rounds.push(round.length);
        },
      },
    );

    expect(most).toBe(4);
    expect(events.filter((each) => each === 'round')).toHaveLength(3);
    expect(events.indexOf('layer 5')).toBeGreaterThan(
      events.indexOf('layer 4'),
    );
    expect(events[5]).toBe('round');
    expect(rounds).toEqual([4, 4, 2]);
    expect(
      done.map((each) => each.outcome === 'layered' && each.cohort.title),
    ).toEqual(Array.from({ length: 10 }, (_, at) => `Cohort ${at + 1}`));
  });
});

describe('combined', () => {
  it('reports a cut-off answer before any other failure', () => {
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

    expect(result).toEqual({
      outcome: 'unanswered',
      truncated: true,
      error: 'length',
    });
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

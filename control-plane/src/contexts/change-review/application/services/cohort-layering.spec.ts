import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import {
  type CohortLayering,
  combined,
  layerCohort,
  layeredInRounds,
} from '@change-review/application/services/cohort-layering';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { StackCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  CohortId,
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const CALL = {
  inputTokens: 10,
  outputTokens: 20,
  cost: { amount: 0.01, currency: 'USD' as const },
};

const layered = (title: string): CohortLayering => ({
  outcome: 'layered',
  cohort: { kind: 'change', title, intent: title, layers: [] },
  proposed: { kind: 'change', title, intent: title, layers: [] },
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

describe('layeredInRounds, when a layering crashes', () => {
  it('records the round’s finished layerings before it throws, and starts no later round', async () => {
    const rounds: number[] = [];
    let started = 0;

    await expect(
      layeredInRounds(
        Array.from({ length: 6 }, (_, at) => async () => {
          started += 1;
          if (at === 1) {
            throw new Error('a bug');
          }
          return layered(`Cohort ${at + 1}`);
        }),
        {
          before: async () => undefined,
          after: (round) => {
            rounds.push(round.length);
          },
        },
      ),
    ).rejects.toThrow('a bug');

    expect(rounds).toEqual([3]);
    expect(started).toBe(4);
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

describe('layerCohort', () => {
  const hunk = (id: string) => ({
    path: `src/${id}.ts`,
    previousPath: null,
    status: 'modified' as const,
    binary: false,
    hunks: [
      {
        id: HunkId.of(id),
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        patch: `@@ -1 +1 @@\n-a\n+${id}`,
      },
    ],
  });
  const DIFF = Diff.of([hunk('h1'), hunk('h2')]);
  const FACTS: DiffFacts = {
    hunks: [],
    links: [
      {
        kind: 'moves',
        from: HunkId.of('h2'),
        to: HunkId.of('h1'),
        because: ['src/h1.ts → src/h2.ts'],
      },
    ],
    imports: [],
  };
  const layerOf = (id: string) => ({
    title: `Change ${id}`,
    summary: 'Moves code',
    dependsOn: [],
    hunks: [{ hunk: HunkId.of(id) }],
    notes: [{ path: `src/${id}.ts`, note: 'Why' }],
    questions: [],
  });
  const generator: ChangeStackGeneratorPort = {
    available: true,
    generate: async () => {
      throw new Error('not used');
    },
    outline: async () => {
      throw new Error('not used');
    },
    layers: async () => ({
      layers: [layerOf('h1'), layerOf('h2')],
      usage: null,
    }),
  };
  const twoLayers: StackCohort = {
    id: CohortId.at(1),
    kind: 'change',
    title: 'Moves',
    intent: 'Moves code',
    joinedBecause: null,
    layers: ['h1', 'h2'].map((id, l) => ({
      ...layerOf(id),
      id: LayerId.in(CohortId.at(1), l + 1),
      dependsOn: [],
      questions: [],
      revision: null,
    })),
  };
  const layering = (redrafting?: StackCohort) =>
    layerCohort(generator, {
      diff: DIFF,
      facts: FACTS,
      repository: null,
      cohort: {
        kind: 'change',
        title: 'Moves',
        intent: 'Moves code',
        joinedBecause: null,
        hunks: [HunkId.of('h1'), HunkId.of('h2')],
      },
      redrafting,
    });

  it('puts moved code together only within the layers the cohort had before', async () => {
    const free = await layering();
    const held = await layering(twoLayers);

    expect(free.outcome === 'layered' && free.cohort.layers).toHaveLength(1);
    expect(held.outcome).toBe('broken');
  });
});

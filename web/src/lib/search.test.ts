import { describe, expect, it } from 'vitest';
import type { ReplaySet } from '@/lib/replay';
import {
  budgetFrom,
  byIteration,
  fieldOf,
  frontierPoints,
  heldOutShown,
  iterationTitle,
  pickRefusal,
  refusalsOf,
  type Search,
  type SearchCandidate,
  type SearchDetail,
  searchNumber,
  searchPath,
  setRefusal,
  startRefusal,
} from '@/lib/search';

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const setOf = (tasks: number, over: Partial<ReplaySet> = {}): ReplaySet => ({
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  guardsChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    sanity: null,
  },
  minGain: 0.05,
  composition: {
    outcomes: [
      { outcome: 'accepted', count: 0 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 0 },
      { outcome: 'other', count: 0 },
    ],
    origins: [],
    oldest: null,
    median: null,
    newest: null,
    balanceWarning: null,
  },
  entries: Array.from({ length: tasks + 1 }, (_, place) => ({
    runId: `run_${place}`,
    taskId: `task_${Math.min(place, tasks - 1)}`,
    title: null,
    state: 'completed',
    endedAt: null,
    addedAt: '2026-10-01T09:00:00.000Z',
    refusal: null,
    reason: null,
    outcome: 'other',
    origin: 'person',
  })),
  ...over,
});

const candidate = (over: Partial<SearchCandidate>): SearchCandidate => ({
  candidateId: 'c',
  name: 'shorter',
  seed: false,
  iteration: 1,
  hypothesis: null,
  fingerprint: null,
  changes: [],
  replayId: 'r',
  replayState: 'finished',
  heldOutReplayId: null,
  heldOutReplayState: null,
  searchInterval: null,
  heldOutInterval: null,
  searchedGain: null,
  heldOutGain: null,
  searchedPairs: null,
  heldOutPairs: null,
  searchScore: 0.5,
  searchScored: 4,
  heldOutScore: null,
  costPerRun: 0.5,
  spent: { amount: 2, currency: 'USD' },
  onFrontier: false,
  onlyOnSeenTasks: null,
  pullRequest: null,
  ...over,
});

const INPUTS = {
  iterations: '3',
  perIteration: '2',
  concurrency: '4',
  repeats: '1',
  amount: '20',
  currency: 'USD',
};

describe('search', () => {
  it('places a search under its station', () => {
    expect(searchPath(AT, 'search_1')).toBe(
      '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
    );
  });

  it('counts distinct tasks, not runs, before a set may be searched', () => {
    expect(setRefusal(setOf(4))).toBe(
      'It covers 4 tasks; a search needs runs of at least 5 different tasks, to hold some out.',
    );
    expect(setRefusal(setOf(5))).toBeNull();
    expect(setRefusal(setOf(5, { stationGone: true }))).toBe(
      'Its station is gone from its line.',
    );
  });

  it('refuses to start while a search is under way or no set is big enough', () => {
    expect(startRefusal([setOf(6)], { state: 'searching' } as Search)).toBe(
      'A search of this station is under way.',
    );
    expect(startRefusal([], null)).toBe('Open a replay set first.');
    expect(startRefusal([setOf(2)], null)).toBe(
      'No replay set covers 5 different tasks yet.',
    );
    expect(startRefusal([setOf(2), setOf(6)], null)).toBeNull();
  });

  it('numbers searches from the first started', () => {
    const searches = [
      { id: 'b', startedAt: '2026-10-02T09:00:00.000Z' },
      { id: 'a', startedAt: '2026-10-01T09:00:00.000Z' },
    ] as Search[];

    expect(searchNumber(searches, 'a')).toBe(1);
    expect(searchNumber(searches, 'b')).toBe(2);
    expect(searchNumber(searches, 'c')).toBeNull();
  });

  it('reads a budget, and says what is wrong with each field', () => {
    expect(budgetFrom(INPUTS).budget).toEqual({
      iterations: 3,
      perIteration: 2,
      concurrency: 4,
      repeats: 1,
      ceiling: { amount: 20, currency: 'USD' },
    });

    const { budget, problems } = budgetFrom({
      ...INPUTS,
      iterations: '11',
      perIteration: '1.5',
      repeats: '6',
      amount: '',
    });

    expect(budget).toBeNull();
    expect(problems.iterations).toBe('Give a whole number from 1 to 10.');
    expect(problems.perIteration).toBe('Give a whole number from 1 to 5.');
    expect(problems.repeats).toBe('Give a whole number from 1 to 5.');
    expect(problems.ceiling).toBe('Give a ceiling above nothing.');
    expect(problems.concurrency).toBeUndefined();
  });

  it('places a refusal’s field errors on the fields they name', () => {
    expect(fieldOf('budget.ceiling.amount')).toBe('ceiling');
    expect(fieldOf('agent.harness')).toBe('agent');
    expect(fieldOf('agent.effort')).toBe('agent');
    expect(fieldOf('budget.ceiling.currency')).toBe('ceiling');
    expect(fieldOf('budget.perIteration')).toBe('perIteration');
    expect(fieldOf('budget.repeats')).toBe('repeats');
    expect(fieldOf('setId')).toBe('set');
    expect(fieldOf('elsewhere')).toBeNull();

    expect(
      refusalsOf({
        detail: 'invalid',
        errors: [
          {
            path: 'budget.iterations',
            message: 'is how many times',
            severity: 'error',
          },
        ],
      }),
    ).toEqual({ fields: { iterations: 'is how many times' }, general: null });
    expect(refusalsOf({ status: 409, detail: 'Searched already' })).toEqual({
      fields: {},
      general: 'Searched already',
    });
    expect(refusalsOf(null)).toEqual({ fields: {}, general: null });
  });

  it('may pick only a candidate whose search replay finished, never the seed', () => {
    expect(pickRefusal(candidate({}))).toBeNull();
    expect(pickRefusal(candidate({ replayState: 'running' }))).toBe(
      'It can be picked once its replay on the searched tasks finishes.',
    );
    expect(pickRefusal(candidate({ seed: true }))).not.toBeNull();
    expect(pickRefusal(candidate({ replayState: 'stopped' }))).toBe(
      'It can’t be picked: its replay was stopped before it finished.',
    );
    expect(pickRefusal(candidate({ replayState: 'over-budget' }))).toBe(
      'It can’t be picked: its replay ran over its ceiling before it finished.',
    );
  });

  it('says whether a candidate was held out', () => {
    expect(heldOutShown(candidate({}))).toBe('Not held out');
    expect(
      heldOutShown(
        candidate({ heldOutReplayId: 'h', heldOutReplayState: 'running' }),
      ),
    ).toBe('Replaying');
    expect(heldOutShown(candidate({ seed: true }))).toBe('–');
  });

  it('plots priced scores, and keeps the unpriced apart', () => {
    const detail = {
      seed: candidate({ candidateId: 'seed', seed: true, onFrontier: true }),
      candidates: [
        candidate({ candidateId: 'a', costPerRun: null }),
        candidate({ candidateId: 'b', searchScore: null }),
        candidate({ candidateId: 'c', replayState: 'running' }),
      ],
    } as SearchDetail;

    const { priced, unpriced, unfinished } = frontierPoints(detail);

    expect(priced.map((each) => each.id)).toEqual(['seed']);
    expect(priced[0]?.name).toBe('Live config');
    expect(unpriced.map((each) => each.candidateId)).toEqual(['a']);
    expect(unfinished.map((each) => each.candidateId)).toEqual(['c']);
  });

  it('groups candidates by iteration, keeping iterations that proposed nothing', () => {
    const detail = {
      iterations: [
        { number: 1, state: 'ended' },
        { number: 2, state: 'failed' },
      ],
      candidates: [candidate({ candidateId: 'a', iteration: 1 })],
    } as SearchDetail;

    expect(
      byIteration(detail).map((group) => [
        group.number,
        group.candidates.length,
      ]),
    ).toEqual([
      [1, 1],
      [2, 0],
    ]);
  });
});

describe('iterationTitle', () => {
  it('names an iteration by its search, or by search alone where its number is unknown', () => {
    expect(iterationTitle(3, 2)).toBe('Iteration 3 of Search 2');
    expect(iterationTitle(1, null)).toBe('Iteration 1 of Search');
  });
});

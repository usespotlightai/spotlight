import { describe, expect, it } from 'vitest';
import type { ReplaySet } from '@/lib/replay';
import {
  budgetFrom,
  byIteration,
  fieldOf,
  formatHeldOut,
  frontierPoints,
  iterationTitle,
  pickProblem,
  problemsOf,
  replayCheckNote,
  type Search,
  type SearchCandidate,
  type SearchDetail,
  searchNumber,
  searchPath,
  setProblemOf,
  startProblem,
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
  gatesChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    oracle: null,
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
    unreplayableReason: null,
    reason: null,
    outcome: 'other',
    origin: 'person',
  })),
  ...over,
});

const candidate = (over: Partial<SearchCandidate>): SearchCandidate => ({
  candidateId: 'c',
  name: 'shorter',
  isSeed: false,
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
  overfit: null,
  regressions: { searched: null, heldOut: null, total: null },
  exceedsRegressionLimit: false,
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
    expect(setProblemOf(setOf(4))).toBe(
      'The set covers 4 tasks. A search holds some tasks out. Minimum different tasks: 5',
    );
    expect(setProblemOf(setOf(5))).toBeNull();
    expect(setProblemOf(setOf(5, { stationGone: true }))).toBe(
      'The station is gone from its line.',
    );
  });

  it('says why a search cannot start while a search is under way or no set is big enough', () => {
    expect(startProblem([setOf(6)], { state: 'searching' } as Search)).toBe(
      'A search of this station is in progress.',
    );
    expect(startProblem([], null)).toBe('Create a replay set first.');
    expect(startProblem([setOf(2)], null)).toBe(
      'No replay set covers 5 different tasks yet.',
    );
    expect(startProblem([setOf(2), setOf(6)], null)).toBeNull();
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
    expect(problems.iterations).toBe(
      'Please enter a whole number from 1 to 10.',
    );
    expect(problems.perIteration).toBe(
      'Please enter a whole number from 1 to 5.',
    );
    expect(problems.repeats).toBe('Please enter a whole number from 1 to 5.');
    expect(problems.ceiling).toBe('Please enter a ceiling above 0.');
    expect(problems.concurrency).toBeUndefined();
  });

  it('places a rejection’s field errors on the fields they name', () => {
    expect(fieldOf('budget.ceiling.amount')).toBe('ceiling');
    expect(fieldOf('agent.harness')).toBe('agent');
    expect(fieldOf('agent.effort')).toBe('agent');
    expect(fieldOf('budget.ceiling.currency')).toBe('ceiling');
    expect(fieldOf('budget.perIteration')).toBe('perIteration');
    expect(fieldOf('budget.repeats')).toBe('repeats');
    expect(fieldOf('setId')).toBe('set');
    expect(fieldOf('elsewhere')).toBeNull();

    expect(
      problemsOf({
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
    expect(problemsOf({ status: 409, detail: 'Searched already' })).toEqual({
      fields: {},
      general: 'Searched already',
    });
    expect(problemsOf(null)).toEqual({ fields: {}, general: null });
  });

  it('may pick only a candidate whose search replay finished, never the seed', () => {
    expect(pickProblem(candidate({}))).toBeNull();
    expect(pickProblem(candidate({ replayState: 'running' }))).toBe(
      'After its replay on the searched tasks finishes, you can open a pull request.',
    );
    expect(pickProblem(candidate({ isSeed: true }))).not.toBeNull();
    expect(pickProblem(candidate({ replayState: 'stopped' }))).toBe(
      'You can’t open a pull request for this candidate. Its replay stopped before it finished.',
    );
    expect(pickProblem(candidate({ replayState: 'ceiling-reached' }))).toBe(
      'You can’t open a pull request for this candidate. Its replay reached its ceiling before it finished.',
    );
  });

  it('says whether a candidate was held out', () => {
    expect(formatHeldOut(candidate({}))).toBe('Not held out');
    expect(
      formatHeldOut(
        candidate({ heldOutReplayId: 'h', heldOutReplayState: 'running' }),
      ),
    ).toBe('Replaying');
    expect(formatHeldOut(candidate({ isSeed: true }))).toBe('–');
  });

  it('plots finished priced scores, and keeps the unpriced apart', () => {
    const detail = {
      seed: candidate({ candidateId: 'seed', isSeed: true, onFrontier: true }),
      candidates: [
        candidate({ candidateId: 'a', costPerRun: null }),
        candidate({ candidateId: 'b', searchScore: null }),
        candidate({ candidateId: 'c', replayState: 'running' }),
      ],
    } as SearchDetail;

    const { priced, unpriced } = frontierPoints(detail);

    expect(priced.map((each) => each.id)).toEqual(['seed']);
    expect(priced[0]?.name).toBe('Live config');
    expect(unpriced.map((each) => each.candidateId)).toEqual(['a']);
    expect(priced.map((each) => each.id)).not.toContain('c');
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

  it('explains gating, with the line’s threshold or that it sets none', () => {
    expect(
      replayCheckNote({
        maxRegressions: 2,
        ceiling: 10,
        currency: 'USD',
        minGain: 0.05,
      }),
    ).toMatch(
      /Fails past 2 regressions\. Ceiling per check: \$10\.00 · Minimum real gain: \+5 pts$/,
    );
    expect(replayCheckNote(null)).toMatch(/Line sets no replay_check\./);
    expect(replayCheckNote(undefined)).toMatch(
      /^spotlight replay check replays a pull request’s change/,
    );
  });
});

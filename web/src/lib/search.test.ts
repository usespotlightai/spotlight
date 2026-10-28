import { describe, expect, it } from 'vitest';
import {
  byIteration,
  formatHeldOut,
  frontierPoints,
  iterationTitle,
  replayCheckNote,
  type Search,
  type SearchCandidate,
  type SearchDetail,
  searchesPath,
  searchNumber,
  searchPath,
} from '@/lib/search';
import { searchCrumbs } from '@/lib/station-crumbs';

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

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

describe('search', () => {
  it('places a search under its station', () => {
    expect(searchPath(AT, 'search_1')).toBe(
      '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
    );
  });

  it('lists the searches of a station on its replay set', () => {
    expect(searchesPath(AT, 'set_1')).toBe(
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replay-sets/set_1#searches',
    );
  });

  it('walks back from a search to the replay set it searched', () => {
    expect(searchCrumbs(AT, { id: 'search_1', setId: 'set_1' }, 2)).toEqual([
      {
        label: 'Replay set',
        to: '/w/acme/team/team_1/lines/line_1/stations/station_1/replay-sets/set_1',
      },
      {
        label: 'Search 2',
        to: '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
      },
    ]);
    expect(
      searchCrumbs(AT, { id: 'search_1', setId: null }, 2).map(
        (each) => each.label,
      ),
    ).toEqual(['Search 2']);
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

  it('explains the replay check, with the line’s threshold or that it sets none', () => {
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
      /^spotlight replay check replays the change of a pull request/,
    );
  });
});

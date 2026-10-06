import { describe, expect, it } from 'vitest';
import {
  adoptedFrom,
  type CandidatesSet,
  type ConfigOrigin,
  changeBatches,
  changeLinkOf,
  comparedShown,
  costAgainstLiveShown,
  healthShown,
  heldOutShown,
  MOST_CHANGES_ASKED,
  markShown,
  onTheSameShown,
  replayedChart,
  replayedFrontiersOf,
  type SetCandidate,
  stationReplayedChart,
} from '@/lib/insights-candidates';
import { CANDIDATES } from '@/stories/fixtures/insights-candidates';

const at = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_impl',
};

const implementation = CANDIDATES.stations[0]?.sets[0] as CandidatesSet;
const review = CANDIDATES.stations[1]?.sets[0] as CandidatesSet;
const [picked, terse] = implementation.candidates as readonly SetCandidate[];
const proposed = review.candidates[0] as SetCandidate;

const NOW = new Date('2026-10-02T12:00:00.000Z');
const ago = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe('markShown', () => {
  it('names each kind of replayed point', () => {
    expect(markShown('searched')).toBe('Searched');
    expect(markShown('proposed')).toBe('Proposed');
    expect(markShown('baseline')).toBe('Live config');
  });
});

describe('replayedChart', () => {
  it('charts the live config on each search’s own tasks and the priced candidates, and lists the unpriced apart', () => {
    const chart = replayedChart(implementation, 'USD');

    expect(chart.priced.map((each) => [each.label, each.mark])).toEqual([
      ['Live config, replayed (the search’s tasks)', 'baseline'],
      ['opus-with-migrations-skill', 'searched'],
      ['sonnet-terse-prompt', 'searched'],
    ]);
    expect(chart.unpriced).toEqual([
      expect.objectContaining({ label: 'cursor-careful-profile' }),
    ]);
    expect(chart.priced.some((each) => each.cost === 0)).toBe(false);
  });

  it('charts only finished replays, listing the rest with their state', () => {
    const chart = replayedChart(implementation, 'USD');

    expect(chart.priced.map((each) => each.label)).not.toContain(
      'sonnet-plan-first',
    );
    expect(chart.unfinished).toEqual([
      expect.objectContaining({ label: 'sonnet-plan-first', note: 'running' }),
    ]);
  });

  it('sets the whole set’s live replay only beside proposed candidates', () => {
    expect(
      replayedChart(review, 'USD').priced.map((each) => [
        each.label,
        each.value,
      ]),
    ).toEqual([
      ['Live config, replayed (whole set)', 0.75],
      ['review-against-spec', 0.67],
      ['one-comment-per-problem', 0.75],
    ]);
  });

  it('names each search’s live replay by its day where a set was searched more than once', () => {
    const [first, second] = implementation.candidates as SetCandidate[];
    const chart = replayedChart(
      {
        ...implementation,
        candidates: [
          first as SetCandidate,
          {
            ...(second as SetCandidate),
            search: {
              searchId: 'search_2',
              state: 'finished',
              objective: 'success',
              startedAt: '2026-09-28T10:00:00.000Z',
              seed: {
                successRate: 0.5,
                interval: null,
                costPerRun: 0.5,
                scored: 10,
              },
            },
          },
        ],
      },
      'USD',
    );

    expect(
      chart.priced.filter((each) => each.mark === 'baseline'),
    ).toHaveLength(2);
    expect(chart.priced[1]?.label).toMatch(
      /^Live config, replayed \(tasks of the search on .*28/,
    );
  });

  it('keeps the held-out score off the chart’s height', () => {
    const point = replayedChart(implementation, 'USD').priced.find(
      (each) => each.label === 'opus-with-migrations-skill',
    );

    expect(point?.value).toBe(0.72);
    expect(point?.heldOut).toBe('67% of 7 held-out runs');
  });

  it('carries a held-out score only, never a reason there is none', () => {
    const terse = replayedChart(implementation, 'USD').priced.find(
      (each) => each.label === 'sonnet-terse-prompt',
    );

    expect(terse?.heldOut).toBeNull();
  });

  it('leaves points priced in another currency off the chart', () => {
    const chart = replayedChart(implementation, 'EUR');

    expect(chart.priced).toEqual([]);
    expect(chart.otherCurrency).toHaveLength(3);
    expect(chart.unpriced).toHaveLength(1);
  });
});

describe('replayedFrontiersOf', () => {
  it('joins each search’s frontier from cheapest to dearest', () => {
    const frontiers = replayedFrontiersOf(
      replayedChart(implementation, 'USD').priced,
    );

    expect(frontiers.map((each) => each.map((point) => point.label))).toEqual([
      [
        'sonnet-terse-prompt',
        'Live config, replayed (the search’s tasks)',
        'opus-with-migrations-skill',
      ],
    ]);
  });
});

describe('stationReplayedChart', () => {
  it('takes only the station’s points in the setups’ currency', () => {
    expect(
      stationReplayedChart(CANDIDATES, 'station_review', 'USD').priced.map(
        (each) => each.label,
      ),
    ).toEqual([
      'Live config, replayed (whole set)',
      'review-against-spec',
      'one-comment-per-problem',
    ]);

    const unpriced = stationReplayedChart(CANDIDATES, 'station_review', null);
    expect(unpriced.priced).toEqual([]);
    expect(unpriced.otherCurrency).toHaveLength(3);
  });

  it('lists what is not scored yet apart', () => {
    const chart = stationReplayedChart(
      {
        ...CANDIDATES,
        stations: [
          {
            lineId: 'line_1',
            stationId: 'station_implementation',
            sets: [
              {
                ...implementation,
                candidates: [
                  { ...(terse as SetCandidate), successRate: null, scored: 0 },
                ],
              },
            ],
          },
        ],
      },
      'station_implementation',
      'USD',
    );

    expect(chart.unscored.map((each) => each.label)).toEqual([
      'sonnet-terse-prompt',
    ]);
  });
});

describe('heldOutShown', () => {
  it('says why a searched candidate has no held-out score', () => {
    expect(heldOutShown(picked as SetCandidate)).toBe('–');
    expect(heldOutShown(terse as SetCandidate)).toBe('Not held out');
    expect(
      heldOutShown({
        ...(picked as SetCandidate),
        heldOut: {
          replayId: 'r',
          state: 'running',
          score: null,
          interval: null,
          tasks: 6,
          runs: 0,
        },
      }),
    ).toBe('Replaying');
    expect(heldOutShown(proposed)).toBeNull();
  });
});

describe('changeLinkOf', () => {
  it('leads to the pull request once it opened', () => {
    expect(changeLinkOf(at, picked as SetCandidate)).toEqual({
      label: 'Pull request',
      to: 'https://github.com/acme/spotlight-config/pull/42',
      external: true,
    });
  });

  it('leads a searched candidate without one to its place on the search', () => {
    expect(changeLinkOf(at, terse as SetCandidate)).toEqual({
      label: 'Pick on the search',
      to: '/w/acme/team/team_1/lines/line_1/stations/station_impl/searches/search_1#candidate-candidate_terse',
      external: false,
    });
  });

  it('leads a proposed candidate to its replay', () => {
    expect(changeLinkOf(at, proposed)).toEqual({
      label: 'View changes',
      to: '/w/acme/team/team_1/lines/line_1/stations/station_impl/replays/replay_spec_review',
      external: false,
    });
  });

  it('does not lead to a pull request still opening', () => {
    expect(
      changeLinkOf(at, {
        ...(picked as SetCandidate),
        pullRequest: {
          id: 'pr',
          state: 'opening',
          url: null,
          reason: null,
        },
      }).label,
    ).toBe('Pick on the search');
  });
});

describe('onTheSameShown and costAgainstLiveShown', () => {
  it('sets the candidate beside live on the runs both replayed', () => {
    expect(onTheSameShown(proposed.compared)).toBe('on the same 12 runs');
    expect(costAgainstLiveShown(proposed)).toBe(
      'cost $0.24 vs live $0.21 a run on the same 12 runs',
    );
  });

  it('compares costs only in the same currency', () => {
    expect(
      costAgainstLiveShown({
        ...proposed,
        live: {
          successRate: 0.75,
          interval: null,
          costPerRun: 0.21,
          currency: 'EUR',
        },
      }),
    ).toBeNull();
  });
});

describe('comparedShown', () => {
  it('counts the regressions among the tasks compared with live', () => {
    expect(comparedShown(proposed)).toBe('2 regressions over 12 runs compared');
    expect(comparedShown({ ...proposed, regressions: 1 })).toBe(
      '1 regression over 12 runs compared',
    );
    expect(comparedShown({ ...proposed, regressions: null })).toBe(
      'No baseline to compare with',
    );
    expect(comparedShown({ ...proposed, regressions: 0, compared: 0 })).toBe(
      'No runs compared yet',
    );
  });
});

describe('healthShown', () => {
  it('says how many tasks the set holds, how old their runs are and when one was last added', () => {
    expect(
      healthShown(
        {
          tasks: 40,
          runs: 52,
          oldestRunEndedAt: ago(41),
          newestRunEndedAt: ago(3),
          lastAddedAt: ago(2),
          noise: null,
          saturation: null,
          judge: null,
          checks: null,
          sanity: null,
          minGain: 0.05,
        },
        NOW,
      ),
    ).toBe('40 tasks (52 runs) · ended 3–41 days ago · last added 2 days ago');
  });

  it('reads well for runs that ended today and a single task', () => {
    expect(
      healthShown(
        {
          tasks: 1,
          runs: 1,
          oldestRunEndedAt: ago(0),
          newestRunEndedAt: ago(0),
          lastAddedAt: ago(1),
          noise: null,
          saturation: null,
          judge: null,
          checks: null,
          sanity: null,
          minGain: 0.05,
        },
        NOW,
      ),
    ).toBe('1 task · ended today · last added 1 day ago');
    expect(
      healthShown(
        {
          tasks: 2,
          runs: 2,
          oldestRunEndedAt: ago(5),
          newestRunEndedAt: ago(0),
          lastAddedAt: null,
          noise: null,
          saturation: null,
          judge: null,
          checks: null,
          sanity: null,
          minGain: 0.05,
        },
        NOW,
      ),
    ).toBe('2 tasks · ended today to 5 days ago');
  });

  it('says when the set holds nothing', () => {
    expect(
      healthShown(
        {
          tasks: 0,
          runs: 0,
          oldestRunEndedAt: null,
          newestRunEndedAt: null,
          lastAddedAt: null,
          noise: null,
          saturation: null,
          judge: null,
          checks: null,
          sanity: null,
          minGain: 0.05,
        },
        NOW,
      ),
    ).toBe('No tasks yet');
  });
});

describe('adoptedFrom', () => {
  const change = { stationId: 'station_review', runId: 'run_review_20' };
  const origin: ConfigOrigin = {
    stationId: change.stationId,
    runId: change.runId,
    fingerprint: 'd'.repeat(64),
    changedAt: '2026-10-01T09:00:00.000Z',
    candidateId: 'candidate_one_comment',
    name: 'one-comment-per-problem',
    kind: 'proposed',
    lineId: 'line_delivery',
    searchId: null,
    replayId: 'replay_one_comment',
    createdAt: '2026-09-29T09:00:00.000Z',
    withdrawn: false,
  };

  it('links a config change to the candidate it came from', () => {
    expect(adoptedFrom([origin], change, 'acme', 'team_platform')).toEqual({
      name: 'one-comment-per-problem',
      to: '/w/acme/team/team_platform/lines/line_delivery/stations/station_review/replays/replay_one_comment',
      withdrawn: false,
    });
  });

  it('links a searched candidate to its place in its search', () => {
    expect(
      adoptedFrom(
        [{ ...origin, kind: 'searched', searchId: 'search_1', replayId: null }],
        change,
        'acme',
        'team_platform',
      )?.to,
    ).toContain('/searches/search_1');
  });

  it('names a withdrawn candidate, without a link', () => {
    expect(
      adoptedFrom(
        [
          {
            ...origin,
            kind: 'searched',
            searchId: 'search_1',
            withdrawn: true,
          },
        ],
        change,
        'acme',
        'team_platform',
      ),
    ).toEqual({ name: 'one-comment-per-problem', to: null, withdrawn: true });
  });

  it('names a candidate it cannot link to, without a link', () => {
    expect(
      adoptedFrom(
        [{ ...origin, replayId: null }],
        change,
        'acme',
        'team_platform',
      ),
    ).toEqual({ name: 'one-comment-per-problem', to: null, withdrawn: false });
  });

  it('links only the change the origin was found for', () => {
    expect(
      adoptedFrom(
        [origin],
        { ...change, runId: 'run_review_21' },
        'acme',
        'team_platform',
      ),
    ).toBeNull();
  });
});

describe('changeBatches', () => {
  const change = (at: number) => ({
    stationId: 'station_review',
    runId: `run_${at}`,
  });

  it('asks about each change once, in batches the server takes', () => {
    const many = Array.from({ length: MOST_CHANGES_ASKED + 1 }, (_, at) =>
      change(at),
    );

    expect(
      changeBatches([...many, change(0)]).map((each) => each.length),
    ).toEqual([MOST_CHANGES_ASKED, 1]);
  });

  it('asks by the run the change took effect in', () => {
    expect(changeBatches([change(1)])).toEqual([
      [{ stationId: 'station_review', runId: 'run_1' }],
    ]);
  });

  it('asks nothing for no changes', () => {
    expect(changeBatches([])).toEqual([]);
  });
});

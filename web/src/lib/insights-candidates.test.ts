import { describe, expect, it } from 'vitest';
import {
  type CandidatesSet,
  changeLinkOf,
  costBasisNote,
  formatSource,
  replayedFrontiersOf,
  replayedPoints,
  type SetCandidate,
  stationReplayedPoints,
} from '@/lib/insights-candidates';
import { CANDIDATES } from '@/test/fixtures/insights-candidates';

const at = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_impl',
};

const implementation = CANDIDATES.stations[0]?.sets[0] as CandidatesSet;
const review = CANDIDATES.stations[1]?.sets[0] as CandidatesSet;
const [picked, terse] = implementation.candidates as readonly SetCandidate[];
const proposed = review.candidates.find(
  (each) => each.candidateId === 'candidate_spec_review',
) as SetCandidate;

describe('formatSource', () => {
  it('names each kind of replayed point', () => {
    expect(formatSource('searched')).toBe('Search');
    expect(formatSource('proposed')).toBe('Proposed');
    expect(formatSource('baseline')).toBe('Live');
  });
});

describe('replayedPoints', () => {
  it('charts the live config on each search’s own tasks and the points the server prices', () => {
    expect(
      replayedPoints(implementation).map((each) => [each.label, each.mark]),
    ).toEqual([
      ['Live config, replayed (the search’s tasks)', 'baseline'],
      ['opus-with-migrations-skill', 'searched'],
      ['sonnet-terse-prompt', 'searched'],
    ]);
  });

  it('leaves off every point the server does not price', () => {
    const labels = replayedPoints(implementation).map((each) => each.label);

    expect(labels).not.toContain('cursor-careful-profile');
    expect(labels).not.toContain('sonnet-plan-first');
  });

  it('sets the whole set’s live replay only beside proposed candidates', () => {
    expect(
      replayedPoints(review).map((each) => [each.label, each.value]),
    ).toEqual([
      ['Live config, replayed (whole set)', 0.75],
      ['one-comment-per-problem', 0.75],
      ['review-against-spec', 0.67],
    ]);
  });

  it('names each search’s live replay by its day where a set was searched more than once', () => {
    const [first, second] = implementation.candidates as SetCandidate[];
    const points = replayedPoints({
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
              chartStatus: 'priced',
            },
          },
        },
      ],
    });

    expect(points.filter((each) => each.mark === 'baseline')).toHaveLength(2);
    expect(points[1]?.label).toMatch(
      /^Live config, replayed \(tasks of the search on .*28/,
    );
  });

  it('keeps the held-out score off the chart’s height', () => {
    const point = replayedPoints(implementation).find(
      (each) => each.label === 'opus-with-migrations-skill',
    );

    expect(point?.value).toBe(0.72);
    expect(point?.heldOut).toBe('67% of 7 held-out runs');
  });

  it('carries a held-out score only, never a reason there is none', () => {
    const terse = replayedPoints(implementation).find(
      (each) => each.label === 'sonnet-terse-prompt',
    );

    expect(terse?.heldOut).toBeNull();
  });
});

describe('replayedFrontiersOf', () => {
  it('joins each search’s frontier from cheapest to dearest', () => {
    const frontiers = replayedFrontiersOf(replayedPoints(implementation));

    expect(frontiers.map((each) => each.map((point) => point.label))).toEqual([
      [
        'sonnet-terse-prompt',
        'Live config, replayed (the search’s tasks)',
        'opus-with-migrations-skill',
      ],
    ]);
  });
});

describe('stationReplayedPoints', () => {
  it('takes only the station’s sets priced in the agent configs’ currency', () => {
    expect(
      stationReplayedPoints(CANDIDATES, 'station_review', 'USD')?.map(
        (each) => each.label,
      ),
    ).toEqual([
      'Live config, replayed (whole set)',
      'one-comment-per-problem',
      'review-against-spec',
    ]);
    expect(stationReplayedPoints(CANDIDATES, 'station_review', 'EUR')).toEqual(
      [],
    );
    expect(stationReplayedPoints(CANDIDATES, 'station_review', null)).toEqual(
      [],
    );
  });

  it('tells a station with nothing replayed from one with nothing priced', () => {
    expect(stationReplayedPoints(CANDIDATES, 'station_gone', 'USD')).toBeNull();
  });
});

describe('changeLinkOf', () => {
  it('leads to the pull request once it opened', () => {
    expect(changeLinkOf(at, picked as SetCandidate)).toEqual({
      to: 'https://github.com/acme/spotlight-config/pull/42',
      external: true,
    });
  });

  it('leads a searched candidate without one to its place on the search', () => {
    expect(changeLinkOf(at, terse as SetCandidate)).toEqual({
      to: '/w/acme/team/team_1/lines/line_1/stations/station_impl/searches/search_1#candidate-candidate_terse',
      external: false,
    });
  });

  it('leads a proposed candidate to its replay', () => {
    expect(changeLinkOf(at, proposed)).toEqual({
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
          closedBecause: null,
          closeFailure: null,
          url: null,
          reason: null,
        },
      }).to,
    ).toBe(
      `/w/acme/team/team_1/lines/line_1/stations/station_impl/searches/search_1#candidate-${picked?.candidateId}`,
    );
  });
});

describe('costBasisNote', () => {
  const candidate = picked as SetCandidate;

  it('says nothing when the cost covers the runs the rates do', () => {
    expect(costBasisNote(candidate)).toBeNull();
  });

  it('says the cost covers all scored runs when live is priced in another currency', () => {
    expect(
      costBasisNote({
        ...candidate,
        shown: { ...candidate.shown, basis: 'compared', costBasis: 'overall' },
      }),
    ).toBe(
      'Cost is over all its scored runs. The live config is priced in another currency.',
    );
  });
});

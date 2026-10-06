import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import {
  candidateKindOf,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  possibleOf,
  STATION,
  startAt,
} from '@replays/domain/replays.fake-spec';
import type { ChangeAskedAbout } from '@replays/domain/services/changes-asked-about';
import {
  adoptionsOf,
  boundsOf,
  latestCredited,
  originAskedAbout,
} from '@replays/domain/services/config-origins';
import type { StretchStart } from '@replays/domain/services/stretch-starts';
import type { PossibleOrigin } from '@replays/domain/value-objects/config-origin.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const askedOf = (
  runId: string,
  stationId = STATION.stationId,
): ChangeAskedAbout => ({
  stationId,
  runId: RunId.of(runId),
});

const proposed = (id: string, at = later(0)) =>
  candidateKindOf({ kind: 'proposed', id, at });

const withdrawn = (candidate: Candidate) => {
  const origin = candidate.possibleOrigin;

  if (!origin) {
    throw new Error(`${candidate.kind} candidates are no config origin`);
  }

  return { ...origin, withdrawn: true };
};

const startWith = (runId: string, at: Date, fingerprint: StationFingerprint) =>
  startAt(at, { runId: RunId.of(runId), fingerprint });

const creditedFor = (
  start: StretchStart,
  possible: readonly PossibleOrigin[],
) =>
  originAskedAbout(
    { stationId: start.stationId, runId: start.runId },
    [start],
    possible,
  );

const backAndForth = [
  startWith('run_a0', later(1), FINGERPRINT),
  startWith('run_b', later(2), LIVE_FINGERPRINT),
  startWith('run_a2', later(4), FINGERPRINT),
];

describe('crediting a stretch start', () => {
  it('credits the newest searched or proposed candidate made no later than the stretch started', () => {
    expect(
      creditedFor(
        startAt(later(5)),
        possibleOf(
          candidateKindOf({ kind: 'proposed', id: 'older', at: later(0) }),
          candidateKindOf({ kind: 'searched', id: 'newer', at: later(1) }),
        ),
      )?.candidate.id.value,
    ).toBe('newer');
  });

  it('credits a candidate made the moment the stretch started', () => {
    expect(
      creditedFor(startAt(later(1)), possibleOf(proposed('made', later(1))))
        ?.candidate.id.value,
    ).toBe('made');
  });

  it('passes over a candidate made after the stretch started, though it has the config, so a manual edit is not credited to a later candidate', () => {
    expect(
      creditedFor(startAt(later(1)), possibleOf(proposed('later', later(2)))),
    ).toBeNull();
    expect(
      creditedFor(
        startAt(later(1)),
        possibleOf(proposed('before', later(0)), proposed('after', later(2))),
      )?.candidate.id.value,
    ).toBe('before');
  });

  it('ignores a candidate at another station or with another config', () => {
    expect(
      creditedFor(
        startAt(later(1)),
        possibleOf(
          candidateKindOf({
            kind: 'proposed',
            id: 'review',
            stationId: 'station_review',
          }),
        ),
      ),
    ).toBeNull();
    expect(
      creditedFor(
        startAt(later(1), { fingerprint: LIVE_FINGERPRINT }),
        possibleOf(proposed('proposed')),
      ),
    ).toBeNull();
  });

  it('credits a withdrawn candidate, saying it was withdrawn', () => {
    const origin = creditedFor(startAt(later(5)), [
      ...possibleOf(proposed('older', later(0))),
      withdrawn(proposed('gone', later(1))),
    ]);

    expect(origin?.candidate.id.value).toBe('gone');
    expect(origin?.withdrawn).toBe(true);
    expect(
      creditedFor(startAt(later(5)), possibleOf(proposed('kept')))?.withdrawn,
    ).toBe(false);
  });

  it.each(['live', 'sanity', 'planned'] as const)(
    'never takes a %s candidate for a possible origin',
    (kind) => {
      expect(candidateKindOf({ kind, id: kind }).possibleOrigin).toBeNull();
    },
  );

  it('breaks a tie in time by id', () => {
    expect(
      creditedFor(
        startAt(later(5)),
        possibleOf(proposed('candidate_b'), proposed('candidate_a')),
      )?.candidate.id.value,
    ).toBe('candidate_a');
  });
});

describe('originAskedAbout', () => {
  it('answers a change with the candidate credited by the stretch start of its run, A to B and back to A', () => {
    const possible = possibleOf(
      proposed('first', later(0)),
      proposed('second', later(3)),
    );

    expect(
      originAskedAbout(askedOf('run_a0'), backAndForth, possible)?.candidate.id
        .value,
    ).toBe('first');
    expect(
      originAskedAbout(askedOf('run_b'), [...backAndForth].reverse(), possible),
    ).toBeNull();
    expect(
      originAskedAbout(askedOf('run_a2'), backAndForth, possible)?.candidate.id
        .value,
    ).toBe('second');
  });

  it('credits the change back to A to a candidate made before the first change when none came between', () => {
    const origin = originAskedAbout(
      askedOf('run_a2'),
      backAndForth,
      possibleOf(proposed('first', later(0))),
    );

    expect(origin?.candidate.id.value).toBe('first');
    expect(origin?.changedAt).toEqual(later(4));
  });

  it('answers nothing for a run that started no stretch, or at another station', () => {
    const possible = possibleOf(proposed('first', later(0)));

    expect(
      originAskedAbout(askedOf('run_kept'), backAndForth, possible),
    ).toBeNull();
    expect(
      originAskedAbout(
        askedOf('run_a2', 'station_review'),
        backAndForth,
        possible,
      ),
    ).toBeNull();
  });

  it('answers each of two stretch starts at the same moment by its own run', () => {
    const ties = [
      startWith('run_b', later(1), LIVE_FINGERPRINT),
      startWith('run_a', later(1), FINGERPRINT),
    ];
    const possible = possibleOf(
      proposed('first', later(0)),
      candidateKindOf({
        kind: 'proposed',
        id: 'other',
        fingerprint: LIVE_FINGERPRINT,
      }),
    );

    expect(
      originAskedAbout(askedOf('run_a'), ties, possible)?.candidate.id.value,
    ).toBe('first');
    expect(
      originAskedAbout(askedOf('run_b'), ties, possible)?.candidate.id.value,
    ).toBe('other');
  });
});

describe('boundsOf', () => {
  it('bounds each possible origin’s station from when it was made, leaving the earliest of a station to outcomes', () => {
    expect(
      boundsOf(
        possibleOf(
          proposed('newer', later(3)),
          proposed('older', later(1)),
          candidateKindOf({
            kind: 'proposed',
            id: 'review',
            stationId: 'station_review',
            at: later(2),
          }),
        ),
      ),
    ).toEqual([
      { stationId: STATION.stationId, from: later(3) },
      { stationId: STATION.stationId, from: later(1) },
      { stationId: 'station_review', from: later(2) },
    ]);
  });
});

describe('latestCredited', () => {
  it('gives each candidate the latest stretch start credited to it, so a station that took it up again shows when', () => {
    const credited = latestCredited(
      [
        ...backAndForth,
        startAt(later(3), {
          runId: RunId.of('run_review'),
          stationId: 'station_review',
        }),
      ],
      possibleOf(
        proposed('proposed', later(0)),
        candidateKindOf({
          kind: 'proposed',
          id: 'elsewhere',
          stationId: 'station_review',
        }),
      ),
    );

    expect([...credited].map(([id, origin]) => [id, origin.changedAt])).toEqual(
      [
        ['proposed', later(4)],
        ['elsewhere', later(3)],
      ],
    );
  });

  it('credits a stretch start to the newest candidate made by then only, leaving an older one at the earlier start', () => {
    const credited = latestCredited(
      backAndForth,
      possibleOf(proposed('first', later(0)), proposed('second', later(3))),
    );

    expect(credited.get('first')?.changedAt).toEqual(later(1));
    expect(credited.get('second')?.changedAt).toEqual(later(4));
  });
});

describe('adoptionsOf', () => {
  it('says when each candidate was last taken up and whether its station runs its config now', () => {
    const possible = possibleOf(proposed('proposed', later(0)));
    const credited = latestCredited(backAndForth, possible);

    expect(
      adoptionsOf(credited, backAndForth, possible, (stationId) =>
        stationId === STATION.stationId ? FINGERPRINT : LIVE_FINGERPRINT,
      ),
    ).toEqual(
      new Map([['proposed', { at: later(4), live: true, creditedTo: null }]]),
    );
    expect(
      adoptionsOf(credited, backAndForth, possible, () => LIVE_FINGERPRINT),
    ).toEqual(
      new Map([['proposed', { at: later(4), live: false, creditedTo: null }]]),
    );
  });

  it('says only the candidate credited with the station’s latest change is live, though an earlier one has the same config, and names the later one on the earlier', () => {
    const possible = possibleOf(
      proposed('first', later(0)),
      proposed('second', later(3)),
    );
    const credited = latestCredited(backAndForth, possible);

    expect(
      adoptionsOf(credited, backAndForth, possible, () => FINGERPRINT),
    ).toEqual(
      new Map([
        [
          'first',
          {
            at: later(1),
            live: false,
            creditedTo: {
              candidateId: 'second',
              name: 'Proposed second',
              withdrawn: false,
            },
          },
        ],
        ['second', { at: later(4), live: true, creditedTo: null }],
      ]),
    );
  });

  it('says when the later candidate named on the earlier has been withdrawn', () => {
    const possible = [
      ...possibleOf(proposed('first', later(0))),
      withdrawn(proposed('second', later(3))),
    ];

    expect(
      adoptionsOf(
        latestCredited(backAndForth, possible),
        backAndForth,
        possible,
        () => FINGERPRINT,
      ).get('first')?.creditedTo,
    ).toEqual({
      candidateId: 'second',
      name: 'Proposed second',
      withdrawn: true,
    });
  });

  it('names no later candidate where the station’s latest change went to another config', () => {
    const possible = possibleOf(
      proposed('first', later(0)),
      proposed('second', later(3)),
    );
    const starts = [
      ...backAndForth,
      startWith('run_c', later(6), LIVE_FINGERPRINT),
    ];

    expect(
      adoptionsOf(
        latestCredited(starts, possible),
        starts,
        possible,
        () => LIVE_FINGERPRINT,
      ).get('first'),
    ).toEqual({ at: later(1), live: false, creditedTo: null });
  });

  it('says a candidate is not live once its station changed again, even with no candidate credited', () => {
    const possible = possibleOf(proposed('proposed', later(0)));
    const starts = [
      ...backAndForth,
      startWith('run_c', later(6), LIVE_FINGERPRINT),
    ];

    expect(
      adoptionsOf(
        latestCredited(starts, possible),
        starts,
        possible,
        () => FINGERPRINT,
      ),
    ).toEqual(
      new Map([['proposed', { at: later(4), live: false, creditedTo: null }]]),
    );
  });

  it('says a candidate is not live where the station’s config is unknown', () => {
    const possible = possibleOf(proposed('proposed'));
    const starts = [startAt(later(1))];

    expect(
      adoptionsOf(
        latestCredited(starts, possible),
        starts,
        possible,
        () => null,
      ),
    ).toEqual(
      new Map([['proposed', { at: later(1), live: false, creditedTo: null }]]),
    );
  });
});

import { ReadConfigOriginsHandler } from '@replays/application/queries/handlers/read-config-origins.handler';
import { ReadConfigOriginsQuery } from '@replays/application/queries/read-config-origins.query';
import { PossibleOrigins } from '@replays/application/services/possible-origins.service';
import { replayOf } from '@replays/application/services/replayed-candidates.fake-spec';
import {
  accessFor,
  FakeOutcomes,
  FakeWork,
  InMemoryReplays,
  PERSON,
} from '@replays/application/services/replays.fake-spec';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import {
  aSet,
  candidateKindOf,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import {
  MOST_CHANGES,
  type RawChange,
} from '@replays/domain/services/changes-asked-about';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let outcomes: FakeOutcomes;
let work: FakeWork;
let lookedUp: string[];

const replaysLookedUp = (replays: ReplayRepository): ReplayRepository => ({
  ...replays,
  newestOfCandidates: async (ids: readonly CandidateId[]) => {
    lookedUp.push(...ids.map((each) => each.value));
    return replays.newestOfCandidates(ids);
  },
});

const changeOf = (runId: string, raw: Partial<RawChange> = {}): RawChange => ({
  stationId: STATION.stationId,
  runId,
  ...raw,
});

const read = (changes: readonly RawChange[], mayPlan: boolean | null = false) =>
  new ReadConfigOriginsHandler(
    accessFor(memory, work, mayPlan),
    outcomes,
    new PossibleOrigins(memory.candidateRepository, work),
    replaysLookedUp(memory.replayRepository),
  ).execute(new ReadConfigOriginsQuery(STATION.teamId.value, PERSON, changes));

const made = (candidate: Candidate) =>
  memory.candidateRepository.add(candidate);

const ran = (
  at: Date,
  fingerprint = FINGERPRINT,
  stationId: string = STATION.stationId,
  runId?: string,
): RawChange =>
  changeOf(outcomes.ranFrom(at, fingerprint, stationId, runId), { stationId });

const idsOf = async (changes: readonly RawChange[]) =>
  (await read(changes)).origins.map((each) => each.candidateId);

const distinct = (count: number): RawChange[] =>
  Array.from({ length: count }, (_, at) => changeOf(`run_${at}`));

beforeEach(() => {
  memory = new InMemoryReplays();
  outcomes = new FakeOutcomes();
  work = new FakeWork();
  lookedUp = [];
});

describe('ReadConfigOriginsHandler', () => {
  it('names the proposed candidate a config change came from', async () => {
    await made(candidateKindOf({ kind: 'proposed', id: 'candidate_proposed' }));
    const change = ran(later(1));

    expect(await read([change])).toEqual({
      origins: [
        {
          stationId: STATION.stationId,
          runId: change.runId,
          fingerprint: FINGERPRINT.value,
          changedAt: later(1).toISOString(),
          candidateId: 'candidate_proposed',
          name: 'Proposed candidate_proposed',
          kind: 'proposed',
          lineId: STATION.lineId,
          searchId: null,
          replayId: null,
          createdAt: later(0).toISOString(),
          withdrawn: false,
        },
      ],
    });
  });

  it('still names the candidate once it is withdrawn, saying so and linking no replay', async () => {
    const proposed = candidateKindOf({
      kind: 'proposed',
      id: 'candidate_proposed',
    });

    await made(proposed);
    await memory.replayRepository.add(
      replayOf(aSet(3), 'replay_proposed', proposed, later(0)),
    );
    const change = ran(later(1));
    await memory.candidateRepository.save(
      proposed.withdrawn(false, Attribution.spotlight(STATION.workspaceId)),
    );

    expect(await read([change])).toEqual({
      origins: [
        expect.objectContaining({
          candidateId: 'candidate_proposed',
          name: 'Proposed candidate_proposed',
          kind: 'proposed',
          replayId: null,
          withdrawn: true,
        }),
      ],
    });
    expect(lookedUp).toEqual([]);
  });

  it('credits nobody with a proposal Spotlight abandons', async () => {
    const abandoned = candidateKindOf({
      kind: 'proposed',
      id: 'candidate_abandoned',
    });

    await made(abandoned);
    const change = ran(later(1));
    await memory.candidateRepository.save(abandoned.abandoned());

    expect(await read([change])).toEqual({ origins: [] });
  });

  it('keeps crediting a withdrawn proposal, as withdrawn, and credits nobody once its team’s disbanding forgets it', async () => {
    const proposed = candidateKindOf({
      kind: 'proposed',
      id: 'candidate_proposed',
    });

    await made(proposed);
    const change = ran(later(1));
    await memory.candidateRepository.save(
      proposed.withdrawn(false, Attribution.spotlight(STATION.workspaceId)),
    );

    expect((await read([change])).origins).toEqual([
      expect.objectContaining({
        candidateId: 'candidate_proposed',
        replayId: null,
        withdrawn: true,
      }),
    ]);

    await memory.candidateRepository.removeWithdrawn(proposed.id);

    expect(await read([change])).toEqual({ origins: [] });
  });

  it('credits neither a standing nor a withdrawn candidate at a station that is gone', async () => {
    const standing = candidateKindOf({
      kind: 'proposed',
      id: 'standing',
      stationId: 'station_gone',
    });
    const withdrawn = candidateKindOf({
      kind: 'proposed',
      id: 'withdrawn',
      stationId: 'station_gone',
      fingerprint: LIVE_FINGERPRINT,
    });
    await made(standing);
    await made(withdrawn);
    await memory.candidateRepository.save(
      withdrawn.withdrawn(false, Attribution.spotlight(STATION.workspaceId)),
    );
    const changes = [
      ran(later(1), FINGERPRINT, 'station_gone'),
      ran(later(2), LIVE_FINGERPRINT, 'station_gone'),
    ];

    expect(await idsOf(changes)).toEqual(['standing', 'withdrawn']);

    work.gone.add('station_gone');
    outcomes.askedBounds.length = 0;

    expect(await idsOf(changes)).toEqual([]);
    expect(outcomes.askedBounds).toEqual([]);
  });

  it('reads no config changes when no candidate could have made one', async () => {
    const change = ran(later(1));

    expect(await read([change])).toEqual({ origins: [] });
    expect(outcomes.askedBounds).toEqual([]);
  });

  it('reads config changes only at stations with a candidate, from when each there was made', async () => {
    await made(
      candidateKindOf({ kind: 'proposed', id: 'newer', at: later(3) }),
    );
    await made(
      candidateKindOf({ kind: 'proposed', id: 'older', at: later(1) }),
    );

    await read([ran(later(4)), ran(later(5), FINGERPRINT, 'station_review')]);

    expect(
      outcomes.askedBounds.map((bounds) =>
        bounds
          .map((each) => `${each.stationId}@${each.from.toISOString()}`)
          .sort(),
      ),
    ).toEqual([
      [
        `${STATION.stationId}@${later(1).toISOString()}`,
        `${STATION.stationId}@${later(3).toISOString()}`,
      ],
    ]);
  });

  it('answers nothing for a run that did not change the station’s config', async () => {
    await made(candidateKindOf({ kind: 'proposed', id: 'candidate_proposed' }));
    ran(later(1));

    expect(await idsOf([changeOf('run_kept')])).toEqual([]);
  });

  it('credits the newest candidate made by the time the stretch of the run started, A to B and back to A', async () => {
    await made(
      candidateKindOf({ kind: 'proposed', id: 'older', at: later(0) }),
    );
    const first = ran(later(0));
    const away = ran(later(1), LIVE_FINGERPRINT);
    await made(
      candidateKindOf({ kind: 'searched', id: 'newer', at: later(1) }),
    );
    const back = ran(later(2));
    const awayAgain = ran(later(3), LIVE_FINGERPRINT);
    await made(
      candidateKindOf({ kind: 'proposed', id: 'after', at: later(4) }),
    );
    const last = ran(later(4));

    expect(await idsOf([first])).toEqual(['older']);
    expect(await idsOf([away])).toEqual([]);
    expect(await idsOf([back])).toEqual(['newer']);
    expect(await idsOf([awayAgain])).toEqual([]);
    expect(await idsOf([last])).toEqual(['after']);
  });

  it('answers both of two changes at the same moment, each by its own run', async () => {
    await made(candidateKindOf({ kind: 'proposed', id: 'to_a', at: later(0) }));
    await made(
      candidateKindOf({
        kind: 'proposed',
        id: 'to_b',
        at: later(0),
        fingerprint: LIVE_FINGERPRINT,
      }),
    );
    const toB = ran(later(1), LIVE_FINGERPRINT, STATION.stationId, 'run_b');
    const toA = ran(later(1), FINGERPRINT, STATION.stationId, 'run_a');

    expect(
      (await read([toB, toA])).origins.map((each) => [
        each.runId,
        each.candidateId,
        each.changedAt,
      ]),
    ).toEqual([
      ['run_b', 'to_b', later(1).toISOString()],
      ['run_a', 'to_a', later(1).toISOString()],
    ]);
  });

  it('does not credit a manual edit to a candidate made later with the same config', async () => {
    const edited = ran(later(1));
    await made(
      candidateKindOf({ kind: 'proposed', id: 'later', at: later(2) }),
    );

    expect(await idsOf([edited])).toEqual([]);
  });

  it('links a searched candidate to its search, without looking up its replays', async () => {
    const searched = candidateKindOf({
      kind: 'searched',
      id: 'candidate_searched',
    });

    await made(searched);
    await memory.replayRepository.add(
      replayOf(aSet(3), 'replay_searched', searched, later(1)),
    );
    const change = ran(later(2));

    expect(await read([change])).toEqual({
      origins: [
        expect.objectContaining({
          candidateId: 'candidate_searched',
          kind: 'searched',
          searchId: SEARCH_ID.value,
          replayId: null,
          withdrawn: false,
        }),
      ],
    });
    expect(lookedUp).toEqual([]);
  });

  it('links a proposed candidate to its newest replay, looking it up once', async () => {
    const proposed = candidateKindOf({
      kind: 'proposed',
      id: 'candidate_proposed',
    });
    const set = aSet(3);

    await made(proposed);
    const first = ran(later(5));
    ran(later(6), LIVE_FINGERPRINT);
    const back = ran(later(7));
    for (const [id, at] of [
      ['replay_old', later(0)],
      ['replay_new', later(2)],
      ['replay_middle', later(1)],
    ] as const) {
      await memory.replayRepository.add(replayOf(set, id, proposed, at));
    }

    const { origins } = await read([first, back]);

    expect(origins.map((each) => each.replayId)).toEqual([
      'replay_new',
      'replay_new',
    ]);
    expect(lookedUp).toEqual(['candidate_proposed']);
  });

  it('breaks a tie between replays started together by id', async () => {
    const proposed = candidateKindOf({
      kind: 'proposed',
      id: 'candidate_proposed',
    });
    const set = aSet(3);

    await made(proposed);
    const change = ran(later(5));
    await memory.replayRepository.add(
      replayOf(set, 'replay_b', proposed, later(1)),
    );
    await memory.replayRepository.add(
      replayOf(set, 'replay_a', proposed, later(1)),
    );

    const [origin] = (await read([change])).origins;

    expect(origin?.replayId).toBe('replay_a');
  });

  it('leaves out a change no candidate made', async () => {
    await made(candidateKindOf({ kind: 'proposed', id: 'candidate_proposed' }));
    const change = ran(later(1), StationFingerprint.of('c'.repeat(64)));

    expect(await read([change])).toEqual({ origins: [] });
  });

  it('passes over a candidate of another workspace or team for an older one the caller can see', async () => {
    await made(
      candidateKindOf({ kind: 'proposed', id: 'visible', at: later(0) }),
    );
    await made(
      candidateKindOf({
        kind: 'proposed',
        id: 'elsewhere',
        at: later(1),
        workspaceId: WorkspaceId.of('ws_2'),
      }),
    );
    const otherTeam = candidateKindOf({
      kind: 'proposed',
      id: 'other_team',
      at: later(1),
    }).possibleOrigin;
    if (otherTeam) {
      memory.withdrawnOrigins.set('other_team', {
        ...otherTeam,
        withdrawn: true,
        teamId: TeamId.of('team_2'),
      });
    }
    const change = ran(later(2));

    expect(await idsOf([change])).toEqual(['visible']);
  });

  it('answers a run asked about twice at a station once', async () => {
    await made(candidateKindOf({ kind: 'proposed', id: 'candidate_proposed' }));
    const change = ran(later(1));

    expect(await idsOf([change, change])).toEqual(['candidate_proposed']);
  });

  it(`refuses more than ${MOST_CHANGES} changes at once, repeated or not`, async () => {
    for (const changes of [
      distinct(MOST_CHANGES + 1),
      [...distinct(MOST_CHANGES), ...distinct(1)],
    ]) {
      await expect(read(changes)).rejects.toMatchObject({
        name: 'UseCaseFault',
        kind: 'invalid-input',
        message: `${MOST_CHANGES + 1} changes. At most ${MOST_CHANGES} at once.`,
      });
    }
  });

  it('refuses a blank run by its place', async () => {
    await expect(
      read([changeOf('run_1'), changeOf('run_1'), changeOf(' ')]),
    ).rejects.toMatchObject({
      name: 'UseCaseFault',
      kind: 'invalid-input',
      message: 'Change 3: runId is blank.',
    });
  });

  it('answers not found to someone not on the team, before reading what was asked', async () => {
    await expect(read([changeOf(' ')], null)).rejects.toMatchObject({
      name: 'UseCaseFault',
      kind: 'not-found',
    });
  });
});

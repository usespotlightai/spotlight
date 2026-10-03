import { StartReplayHandler } from '@replays/application/commands/handlers/start-replay.handler';
import { StartSanityReplayHandler } from '@replays/application/commands/handlers/start-sanity-replay.handler';
import { StopReplayHandler } from '@replays/application/commands/handlers/stop-replay.handler';
import { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import { StartSanityReplayCommand } from '@replays/application/commands/start-sanity-replay.command';
import { StopReplayCommand } from '@replays/application/commands/stop-replay.command';
import {
  ACTOR,
  accessFor,
  CLOCK,
  FakeWork,
  IDS,
  InMemoryReplays,
  peopleWho,
  snapshotsFor,
  stationsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayStopAsked } from '@replays/domain/events/replay-stop-asked.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import {
  aReplay,
  aSet,
  candidateOf,
  LIVE_FINGERPRINT,
  runIds,
} from '@replays/domain/replays.fake-spec';
import { PROBE_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;

const CEILING = { amount: 5, currency: 'USD' };

const starting = (mayPlan = true) =>
  new StartReplayHandler(
    accessFor(memory, work, mayPlan),
    snapshotsFor(memory, work, mayPlan),
    memory.candidateRepository,
    memory.setRepository,
    memory.replayRepository,
    IDS,
    CLOCK,
    TRANSACTION,
    stationsFor(memory, work),
  );

const baselines = () =>
  new StartWantedBaseline(
    memory.setRepository,
    memory.replayRepository,
    memory.candidateRepository,
    CLOCK,
    TRANSACTION,
  );

const wantedBaselines = async () => {
  for (const event of memory.events.splice(0)) {
    if (event instanceof ReplayBaselineWanted) {
      await baselines().wanted(event);
      await baselines().wanted(event);
    }
  }
};

const start = (candidate: string, mayPlan = true, repeats = 1, probe = false) =>
  starting(mayPlan).execute(
    new StartReplayCommand(
      'team_1',
      'set_1',
      candidate,
      CEILING,
      repeats,
      probe,
      ACTOR,
    ),
  );

beforeEach(async () => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  await memory.setRepository.add(aSet(2));
  await memory.candidateRepository.add(candidateOf('proposed'));
});

describe('StartReplayHandler', () => {
  it('answers why it could not start, though letting go of the live snapshot fails too', async () => {
    memory.candidateRepository.save = async () => {
      throw new Error('the database went away');
    };
    memory.candidateRepository.lockedForUse = async () => null;

    await expect(start('candidate_proposed')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('starts a proposed candidate, and asks for a baseline of the live config beside it, with a ceiling of its own, under an id it names', async () => {
    const started = await start('candidate_proposed');

    if (started.outcome !== 'started' || !started.baseline) {
      throw new Error('no baseline was asked for');
    }

    expect(started.ceiling).toEqual(CEILING);
    expect(started.baseline).toEqual({
      id: expect.any(String),
      ceiling: CEILING,
      status: 'starting',
    });
    expect([...memory.replays.keys()]).toEqual([started.id]);

    await wantedBaselines();

    const baseline = memory.replays.get(started.baseline.id);
    expect(baseline?.baseline).toBe(true);
    expect(baseline?.ceiling.amount).toBe(5);
    expect(memory.candidates.get(baseline?.candidateId.value ?? '')?.kind).toBe(
      'live',
    );
    expect(memory.replays.size).toBe(2);
  });

  it('replays each run of the set as many times as asked, its wanted baseline as many', async () => {
    const started = await start('candidate_proposed', true, 3);

    if (started.outcome !== 'started' || !started.baseline) {
      throw new Error('no baseline was asked for');
    }

    await wantedBaselines();

    const replay = memory.replays.get(started.id);
    const baseline = memory.replays.get(started.baseline.id);

    expect(replay?.repeats).toBe(3);
    expect(replay?.entries.map((each) => each.repeat)).toEqual([
      1, 1, 2, 2, 3, 3,
    ]);
    expect(replay?.originals).toHaveLength(2);
    expect(baseline?.repeats).toBe(3);
  });

  it('refuses to replay a run more than five times', async () => {
    await expect(start('candidate_proposed', true, 6)).rejects.toBeInstanceOf(
      UseCaseFault,
    );
  });

  it('probes the set as the live config, flagged, replaying each run three times', async () => {
    const started = await start('live', true, PROBE_REPEATS, true);

    if (started.outcome !== 'started') {
      throw new Error('the probe did not start');
    }

    const probe = memory.replays.get(started.id);

    expect(probe?.probe).toBe(true);
    expect(probe?.repeats).toBe(3);
    expect(memory.candidates.get(probe?.candidateId.value ?? '')?.kind).toBe(
      'live',
    );
  });

  it('refuses to probe the set with anything but the live config', async () => {
    await expect(
      start('candidate_proposed', true, PROBE_REPEATS, true),
    ).rejects.toBeInstanceOf(UseCaseFault);
    expect([...memory.replays.values()].some((each) => each.probe)).toBe(false);
  });

  it('starts no baseline once another covers the set by the time the wish is heard', async () => {
    const first = await start('candidate_proposed');
    const second = await start('candidate_proposed');
    await wantedBaselines();

    expect(first.outcome === 'started' && first.baseline?.status).toBe(
      'starting',
    );
    expect(second.outcome === 'started' && second.baseline?.status).toBe(
      'starting',
    );
    expect(
      [...memory.replays.values()].filter((each) => each.baseline),
    ).toHaveLength(1);
    expect(
      [...memory.candidates.values()].filter((each) => each.isLive),
    ).toHaveLength(1);
  });

  it('refuses to start, to be started again, when the set came to need a baseline after it looked', async () => {
    await start('candidate_proposed');
    await wantedBaselines();
    const baseline = [...memory.replays.values()].find((each) => each.baseline);
    const ofSet = memory.replayRepository.ofSet;
    let looked = 0;
    memory.replayRepository.ofSet = async (setId) => {
      looked += 1;
      const replays = await ofSet(setId);
      return looked === 1
        ? replays
        : replays.filter((each) => each !== baseline);
    };

    await expect(start('candidate_proposed')).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('lets go of the live config it took for a baseline the set no longer needed once it looked again', async () => {
    const ofSet = memory.replayRepository.ofSet;
    let looked = 0;
    memory.replayRepository.ofSet = async (setId) => {
      looked += 1;
      return looked === 1
        ? []
        : [
            aReplay({
              id: 'replay_baseline',
              count: 2,
              baseline: true,
              candidate: candidateOf('live', 'candidate_other'),
            }),
            ...(await ofSet(setId)),
          ];
    };

    const started = await start('candidate_proposed');

    expect(started.outcome === 'started' && started.baseline).toBeNull();
    expect(
      [...memory.candidates.values()].filter((each) => each.isLive),
    ).toHaveLength(0);
  });

  it('lets go of the live config it took when the replay cannot start after all', async () => {
    memory.setRepository.locked = async () => aSet(0);

    for (const candidate of ['live', 'candidate_proposed']) {
      await expect(start(candidate)).rejects.toBeInstanceOf(UseCaseFault);
    }

    expect(memory.replays.size).toBe(0);
    expect(
      [...memory.candidates.values()].filter((each) => each.isLive),
    ).toHaveLength(0);
  });

  it('asks for no baseline while one covers the set', async () => {
    await start('candidate_proposed');
    await wantedBaselines();
    const again = await start('candidate_proposed');

    expect(again.outcome === 'started' && again.baseline).toBeNull();
  });

  it('makes a replay of the live config the set’s baseline when it has none', async () => {
    const started = await start('live');

    expect(started).toEqual({
      outcome: 'started',
      id: expect.any(String),
      ceiling: CEILING,
      baseline: {
        id: started.outcome === 'started' ? started.id : null,
        ceiling: CEILING,
        status: 'started',
      },
    });
    expect(memory.replays.size).toBe(1);
  });

  it('starts nothing of a set whose station is gone, noting so when Work no longer has it', async () => {
    work.station = async () => null;

    await expect(start('candidate_proposed')).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(memory.replays.size).toBe(0);
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(true);
  });

  it('knows no candidate of another station or team', async () => {
    await expect(start('candidate_elsewhere')).rejects.toBeInstanceOf(
      UseCaseFault,
    );
  });

  it('refuses a ceiling of nothing', async () => {
    await expect(
      starting().execute(
        new StartReplayCommand(
          'team_1',
          'set_1',
          'live',
          { amount: 0, currency: 'USD' },
          1,
          false,
          ACTOR,
        ),
      ),
    ).rejects.toMatchObject({ kind: 'invalid-input' });
  });

  it('refuses one who may not plan', async () => {
    expect(await start('live', false)).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
  });
});

describe('StopReplayHandler', () => {
  it('stops a replay, asking for its runs in flight to be stopped', async () => {
    await memory.replayRepository.add(
      aReplay({ count: 2 }).reserving(1, runIds()),
    );

    await new StopReplayHandler(
      accessFor(memory, work),
      memory.replayRepository,
      CLOCK,
    ).execute(new StopReplayCommand('team_1', 'replay_1', ACTOR));

    expect(memory.replays.get('replay_1')?.current).toBe('stopped');
    expect(memory.events.slice(-3).map((each) => each.constructor)).toEqual([
      ReplayStopped,
      ReplayEnded,
      ReplayStopAsked,
    ]);
  });
});

describe('StartSanityReplayHandler', () => {
  const sanity = (mayPlan = true) =>
    new StartSanityReplayHandler(
      accessFor(memory, work, mayPlan),
      peopleWho(mayPlan),
      work,
      snapshotsFor(memory, work, mayPlan),
      memory.candidateRepository,
      memory.setRepository,
      memory.replayRepository,
      IDS,
      CLOCK,
      TRANSACTION,
      stationsFor(memory, work),
    );

  const strongerAs = (
    model: string | null,
    effort: string | null,
    mayPlan = true,
    repeats = 1,
  ) =>
    sanity(mayPlan).execute(
      new StartSanityReplayCommand(
        'team_1',
        'set_1',
        model,
        effort,
        CEILING,
        repeats,
        ACTOR,
      ),
    );

  beforeEach(() => {
    const examine = work.examine;

    work.examine = async (line, station, block) => {
      const examined = await examine(line, station, block);
      const asked = block as { model?: string };

      return examined.ok
        ? {
            ...examined,
            changedFrom: StationChanges.of(LIVE_FINGERPRINT, [
              {
                part: 'model',
                name: null,
                kind: 'changed',
                was: null,
                now: asked.model ?? null,
              },
            ]),
          }
        : examined;
    };
  });

  it('replays the live config with the model asked for, beside a replay of the live config to compare with', async () => {
    const started = await strongerAs('opus', null);

    if (started.outcome !== 'started') {
      throw new Error('no stronger replay started');
    }

    const replay = memory.replays.get(started.id);
    const stronger = memory.candidates.get(started.candidateId);
    const comparison = memory.replays.get(started.comparison?.id ?? '');

    expect(stronger?.kind).toBe('sanity');
    expect(stronger?.block.value.model).toBe('opus');
    expect(replay?.candidateId.value).toBe(started.candidateId);
    expect(replay?.baseline).toBe(false);
    expect(
      memory.candidates.get(comparison?.candidateId.value ?? '')?.kind,
    ).toBe('live');
    expect(comparison?.baseline).toBe(true);
    expect(comparison?.repeats).toBe(1);
    expect(replay?.comparedWith?.value).toBe(started.comparison?.id);
    expect(started.ceiling).toEqual(CEILING);
  });

  it('starts no second live replay when one of the live config as it is now, run as often, stands', async () => {
    const first = await strongerAs('opus', null);
    const second = await strongerAs('opus', null);

    expect(first.outcome === 'started' && first.comparison).not.toBeNull();
    expect(second.outcome === 'started' && second.comparison).toBeNull();
    expect(
      second.outcome === 'started' &&
        memory.replays.get(second.id)?.comparedWith?.value,
    ).toBe(first.outcome === 'started' ? first.comparison?.id : null);
  });

  it('refuses a stronger config that names nothing new, a model nobody offers or a lower effort, and a caller who may not plan', async () => {
    const unchanged = await strongerAs(null, null);
    const unknown = await strongerAs('gpt-unknown', 'turbo');

    expect(
      unchanged.outcome === 'invalid' &&
        unchanged.problems.map((each) => each.field.rendered),
    ).toEqual(['model']);
    expect(
      unknown.outcome === 'invalid' &&
        unknown.problems.map((each) => each.field.rendered),
    ).toEqual(['model', 'effort']);
    expect(await strongerAs('opus', null, false)).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
    expect(memory.replays.size).toBe(0);
  });

  it('answers the problems the station finds in the stronger config, as with any candidate', async () => {
    work.examine = async () => ({
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path: '',
          at: FieldPath.of(['model']),
          reason: 'is one of the models its harness offers',
        }),
      ],
    });

    const refused = await strongerAs('gpt-unknown', null);

    expect(refused.outcome).toBe('invalid');
    expect(memory.candidates.size).toBe(1);
  });
});

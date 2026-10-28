import { StartReplayHandler } from '@replays/application/commands/handlers/start-replay.handler';
import { StopReplayHandler } from '@replays/application/commands/handlers/stop-replay.handler';
import { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import { StopReplayCommand } from '@replays/application/commands/stop-replay.command';
import type { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import {
  ACTOR,
  accessFor,
  CLOCK,
  FakeWork,
  IDS,
  InMemoryReplays,
  refreshingFor,
  snapshotsFor,
  stationsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayStopRequested } from '@replays/domain/events/replay-stop-requested.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import {
  aReplay,
  aSet,
  candidateOf,
  NOW,
  runIds,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { Money } from '@replays/domain/value-objects/money.vo';
import { CALIBRATION_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;
let refreshing: RefreshKeptSets;

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
    refreshing,
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
    if (event instanceof ReplayBaselineRequested) {
      await baselines().requested(event);
      await baselines().requested(event);
    }
  }
};

const start = (candidate: string, mayPlan = true, repeats = 1) =>
  starting(mayPlan).execute(
    new StartReplayCommand(
      'team_1',
      'set_1',
      candidate,
      CEILING,
      repeats,
      ACTOR,
    ),
  );

beforeEach(async () => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  refreshing = refreshingFor(memory, work);
  await memory.setRepository.add(aSet(2));
  await memory.candidateRepository.add(candidateOf('proposed'));
});

describe('StartReplayHandler', () => {
  it('refreshes the set before it reads it, so the replay covers the newest run', async () => {
    work.recent = [
      {
        runId: RunId.of('run_new'),
        taskId: TaskId.of('task_new'),
        stationId: STATION.stationId,
        unreplayableReason: null,
        reason: null,
        title: 'Newest',
        state: 'completed',
        endedAt: NOW,
        origin: null,
      },
    ];

    await start('candidate_proposed');

    const replay = [...memory.replays.values()].find((each) => !each.baseline);

    expect(replay?.originals.map((each) => each.value)).toContain('run_new');
  });

  it('starts on the set as it is while a replay of it is in progress', async () => {
    await start('candidate_proposed');
    work.recent = [
      {
        runId: RunId.of('run_new'),
        taskId: TaskId.of('task_new'),
        stationId: STATION.stationId,
        unreplayableReason: null,
        reason: null,
        title: 'Newest',
        state: 'completed',
        endedAt: NOW,
        origin: null,
      },
    ];

    await start('candidate_proposed');

    expect(memory.sets.get('set_1')?.runs.map((each) => each.value)).toEqual([
      'original_0',
      'original_1',
    ]);
  });

  it('answers why it could not start, though releasing the live snapshot fails too', async () => {
    memory.candidateRepository.save = async () => {
      throw new Error('the database went away');
    };
    memory.candidateRepository.lockedForUse = async () => null;

    await expect(start('candidate_proposed')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('starts a proposed candidate, and requests a baseline of the live config beside it, with a ceiling of its own, under an id it names', async () => {
    const started = await start('candidate_proposed');

    if (started.outcome !== 'started' || !started.baseline) {
      throw new Error('no baseline was requested');
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
    expect(baseline?.calibration).toBe(false);
    expect(baseline?.ceiling.amount).toBe(5);
    expect(memory.candidates.get(baseline?.candidateId.value ?? '')?.kind).toBe(
      'live',
    );
    expect(memory.replays.size).toBe(2);
  });

  it('replays each run of the set as many times as requested, its requested baseline as many', async () => {
    const started = await start('candidate_proposed', true, 3);

    if (started.outcome !== 'started' || !started.baseline) {
      throw new Error('no baseline was requested');
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

  it('does not replay a run more than five times', async () => {
    await expect(start('candidate_proposed', true, 6)).rejects.toBeInstanceOf(
      ApplicationError,
    );
  });

  it('checks the set with the first baseline of the live config, replaying each run three times with its ceiling raised in step', async () => {
    memory.sets.set('set_1', aSet(5));
    const started = await start('live');

    if (started.outcome !== 'started') {
      throw new Error('the baseline did not start');
    }

    const calibration = memory.replays.get(started.id);

    expect(calibration?.baseline).toBe(true);
    expect(calibration?.calibration).toBe(true);
    expect(calibration?.repeats).toBe(CALIBRATION_REPEATS);
    expect(started.ceiling).toEqual({ amount: 15, currency: 'USD' });
  });

  it('checks the set with the baseline a candidate wants, telling the raised ceiling', async () => {
    memory.sets.set('set_1', aSet(5));
    const started = await start('candidate_proposed');

    if (started.outcome !== 'started' || !started.baseline) {
      throw new Error('no baseline was requested');
    }

    expect(started.baseline.ceiling).toEqual({ amount: 15, currency: 'USD' });

    await wantedBaselines();

    const baseline = memory.replays.get(started.baseline.id);
    expect(baseline?.calibration).toBe(true);
    expect(baseline?.repeats).toBe(CALIBRATION_REPEATS);
    expect(baseline?.ceiling.amount).toBe(15);
  });

  it('starts the wanted baseline on the terms the candidate was told, not on terms worked out again', async () => {
    memory.sets.set('set_1', aSet(5));
    const started = await start('candidate_proposed');
    const wanted = memory.events
      .splice(0)
      .find((each) => each instanceof ReplayBaselineRequested);

    if (
      !(wanted instanceof ReplayBaselineRequested) ||
      started.outcome !== 'started'
    ) {
      throw new Error('no baseline was requested');
    }

    await baselines().requested(
      new ReplayBaselineRequested(
        wanted.replayId,
        wanted.workspaceId,
        wanted.setId,
        wanted.baselineId,
        wanted.candidateId,
        Money.ceiling(4, 'USD'),
        null,
        1,
        1,
        false,
      ),
    );

    const baseline = memory.replays.get(wanted.baselineId.value);
    expect(baseline?.calibration).toBe(false);
    expect(baseline?.repeats).toBe(1);
    expect(baseline?.ceiling.amount).toBe(4);
  });

  it('checks no set of fewer than five runs', async () => {
    const started = await start('live');

    expect(
      started.outcome === 'started' &&
        memory.replays.get(started.id)?.calibration,
    ).toBe(false);
  });

  it('replays the live config plainly once a valid check of it exists', async () => {
    memory.sets.set('set_1', aSet(5));
    await start('live');
    const again = await start('live');

    if (again.outcome !== 'started') {
      throw new Error('the replay did not start');
    }

    const plain = memory.replays.get(again.id);

    expect(plain?.calibration).toBe(false);
    expect(plain?.repeats).toBe(1);
    expect(again.ceiling).toEqual(CEILING);
  });

  it('starts no baseline once another covers the set by the time the request arrives', async () => {
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

  it('does not start, to be started again, when the set came to need a baseline after it looked', async () => {
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

  it('releases the live snapshot it made for a baseline the set no longer needed once it looked again', async () => {
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

  it('releases the live snapshot it made when the replay cannot start after all', async () => {
    memory.setRepository.locked = async () => aSet(0);

    for (const candidate of ['live', 'candidate_proposed']) {
      await expect(start(candidate)).rejects.toBeInstanceOf(ApplicationError);
    }

    expect(memory.replays.size).toBe(0);
    expect(
      [...memory.candidates.values()].filter((each) => each.isLive),
    ).toHaveLength(0);
  });

  it('requests no baseline while one covers the set', async () => {
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
      ApplicationError,
    );
  });

  it('rejects a ceiling of nothing', async () => {
    await expect(
      starting().execute(
        new StartReplayCommand(
          'team_1',
          'set_1',
          'live',
          { amount: 0, currency: 'USD' },
          1,
          ACTOR,
        ),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('denies one who may not plan', async () => {
    expect(await start('live', false)).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
  });
});

describe('StopReplayHandler', () => {
  it('stops a replay, requesting its runs in flight to be stopped', async () => {
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
      ReplayStopRequested,
    ]);
  });
});

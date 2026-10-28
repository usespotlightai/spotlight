import { StartReplayCheckHandler } from '@replays/application/commands/handlers/start-replay-check.handler';
import { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import type { ReplayCheckStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import { ListSetReplayChecksHandler } from '@replays/application/queries/handlers/list-set-replay-checks.handler';
import { ReadReplayCheckHandler } from '@replays/application/queries/handlers/read-replay-check.handler';
import { ListSetReplayChecksQuery } from '@replays/application/queries/list-set-replay-checks.query';
import { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import { EnsureCheckBaselines } from '@replays/application/services/ensure-check-baselines.service';
import {
  ACTOR,
  accessFor,
  CLOCK,
  FakeWork,
  IDS,
  InMemoryChecks,
  InMemoryReplays,
  PERSON,
  peopleWho,
  QUIET,
  snapshotsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import {
  aSet,
  BY,
  LIVE_FINGERPRINT,
  LIVE_HASHES,
  NOW,
  replayedAs,
  STATION,
  sha256,
} from '@replays/domain/replays.fake-spec';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const PLANNED = StationFingerprint.of('c'.repeat(64));

const PLANNED_HASHES = StationHashes.of({
  behaviour: '3'.repeat(64),
  scoring: '4'.repeat(64),
});

const CHECKED = CandidateScoring.of({
  checksChanges: true,
  judge: null,
  rubricVersion: null,
});

const FRESH: IdempotentCreatesPort = {
  reserve: async () => ({ kind: 'new' }),
  recordCreated: async () => {},
};

const PLAN = {
  key: 'build',
  name: 'Build',
  kind: 'work',
  prompt: 'Build it carefully.',
  check: 'true',
  runners: ['gpu'],
};

const threshold = (maxRegressions: number) =>
  ReplayThreshold.of({
    maxRegressions,
    ceiling: 7.5,
    currency: 'USD',
    minGain: 0.05,
  });

let memory: InMemoryReplays;
let work: FakeWork;
let checks: InMemoryChecks;
let validated: { block: unknown; line: unknown }[];

const errorOf = async (call: Promise<unknown>) =>
  call.then(
    () => {
      throw new Error('it was allowed');
    },
    (error: unknown) => {
      if (error instanceof ApplicationError) {
        return error.kind;
      }
      throw error;
    },
  );

const atVersion = (set: ReplaySet, version: number): ReplaySet =>
  ReplaySet.rehydrate({
    id: set.id,
    station: set.station,
    entries: set.entries,
    removedTasks: set.removedTasks,
    createdAt: set.createdAt,
    refreshedAt: set.refreshedAt,
    lastRefresh: set.lastRefresh,
    stationGoneAt: set.stationGoneAt,
    version,
  });

const keptAtStation = (set: ReplaySet = aSet(3)): ReplaySet => {
  set.pullEvents();
  memory.sets.set(set.id.value, set);

  return set;
};

const evaluations = () =>
  new CheckEvaluations(memory.replayRepository, memory.setRepository);

const start = (
  station: unknown = PLAN,
  mayPlan: boolean | null = true,
  line?: unknown,
): Promise<ReplayCheckStartedOutcome> =>
  new StartReplayCheckHandler(
    accessFor(memory, work, mayPlan),
    peopleWho(mayPlan),
    work,
    snapshotsFor(memory, work),
    evaluations(),
    memory.candidateRepository,
    memory.setRepository,
    memory.replayRepository,
    checks,
    FRESH,
    { sha256 },
    IDS,
    CLOCK,
    TRANSACTION,
  ).execute(
    new StartReplayCheckCommand(
      'team_1',
      {
        lineId: 'line_1',
        stationKey: 'build',
        station,
        line,
        reference: { commit: null, pullRequest: 42 },
      },
      1,
      ACTOR,
      'key-1',
    ),
  );

const read = (id: string, mayPlan: boolean | null = false) =>
  new ReadReplayCheckHandler(
    accessFor(memory, work, mayPlan),
    peopleWho(mayPlan),
    work,
    checks,
    evaluations(),
    'https://app.example.test/',
  ).execute(new ReadReplayCheckQuery('team_1', id, PERSON));

const idOf = (started: ReplayCheckStartedOutcome): string => {
  if (started.outcome !== 'created') {
    throw new Error(`it was ${started.outcome}`);
  }

  return started.id;
};

const checkOf = (id: string): ReplayCheck =>
  checks.stored.get(id) as ReplayCheck;

const wantedBaselines = () =>
  memory.events.filter(
    (each): each is ReplayBaselineRequested =>
      each instanceof ReplayBaselineRequested,
  );

const startingBaselines = async () => {
  const starting = new StartWantedBaseline(
    memory.setRepository,
    memory.replayRepository,
    memory.candidateRepository,
    CLOCK,
    TRANSACTION,
  );

  for (const each of wantedBaselines()) {
    await starting.requested(each);
  }
};

const finished = async (replayId: ReplayId, succeeds = true) => {
  const replay = memory.replays.get(replayId.value) as Replay;

  memory.replays.set(
    replayId.value,
    replayedAs(replay, () => (succeeds ? 'completed' : 'failed')),
  );
};

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  checks = new InMemoryChecks(memory.events);
  validated = [];
  work.threshold = threshold(1);
  work.live = async () => ({
    lineKey: 'delivery',
    block: StationBlock.of({
      key: 'build',
      name: 'Build',
      kind: 'work',
      prompt: 'Build it.',
      check: 'npm test',
      diffs: true,
    }),
    fingerprint: LIVE_FINGERPRINT,
    scoring: CHECKED,
    hashes: LIVE_HASHES,
    threshold: work.threshold,
    search: null,
    agent: null,
  });
  work.validate = async (_line, _station, block, line) => {
    validated.push({ block, line: line?.value ?? null });
    return {
      ok: true,
      fingerprint: PLANNED,
      hashes: PLANNED_HASHES,
      liveHashes: LIVE_HASHES,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    };
  };
});

describe('StartReplayCheckHandler', () => {
  it('replays a planned change over the station’s replay set, scored and placed as the live station is, under the live line’s threshold, wanting a baseline', async () => {
    const set = keptAtStation();
    const id = idOf(
      await start(PLAN, true, {
        repositories: [{ name: 'acme/api', image: 'ghcr.io/acme/api:next' }],
      }),
    );
    const check = checkOf(id);
    const replay = memory.replays.get(check.replayId.value);
    const candidate = memory.candidates.get(
      check.candidateId.value,
    ) as Candidate;

    expect(validated).toEqual([
      {
        block: {
          key: 'build',
          name: 'Build',
          kind: 'work',
          prompt: 'Build it carefully.',
          check: 'npm test',
          diffs: true,
        },
        line: {
          repositories: [{ name: 'acme/api', image: 'ghcr.io/acme/api:next' }],
        },
      },
    ]);
    expect(check.scoringPinnedToLive).toEqual(['check', 'runners']);
    expect(check.attempt).toBe(1);
    expect(check.setEntries).toBe(
      sha256(
        set.runs
          .map((each) => each.value)
          .sort()
          .join('\n'),
      ),
    );
    expect(check.threshold.maxRegressions).toBe(1);
    expect(replay?.ceiling.amount).toBe(7.5);
    expect(replay?.unpricedRate?.amount).toBe(2.5);
    expect(wantedBaselines()[0]?.unpricedRate?.amount).toBe(2.5);
    expect(replay?.scoringHash).toBe(PLANNED_HASHES.scoring);
    expect(candidate.kind).toBe('planned');
    expect(candidate.line?.repositories).toEqual([
      { name: 'acme/api', image: 'ghcr.io/acme/api:next' },
    ]);
    expect(wantedBaselines()).toHaveLength(1);
    expect(
      memory.events.some((each) => each instanceof ReplayCheckStarted),
    ).toBe(true);
  });

  it('answers the check a change already has while it runs, passed or failed on the same set runs and threshold, even once the set was renamed', async () => {
    const set = keptAtStation();
    const first = idOf(await start());

    expect(await start()).toEqual({ outcome: 'reused', id: first });

    memory.sets.set(set.id.value, atVersion(set, set.version + 3));
    expect(await start()).toEqual({ outcome: 'reused', id: first });
    expect(checks.stored.size).toBe(1);
  });

  it('starts another attempt once the earlier one is undecided, the threshold changed, or the set changed', async () => {
    const set = keptAtStation();
    const first = idOf(await start());

    memory.replays.set(
      checkOf(first).replayId.value,
      (memory.replays.get(checkOf(first).replayId.value) as Replay).stop(
        NOW,
        BY,
      ),
    );
    const second = idOf(await start());
    expect(second).not.toBe(first);
    expect(checkOf(second).attempt).toBe(2);

    work.threshold = threshold(3);
    const third = idOf(await start());
    expect(checkOf(third).attempt).toBe(3);

    memory.sets.set(
      set.id.value,
      set.refresh(
        {
          add: [
            {
              runId: RunId.of('original_9'),
              taskId: TaskId.of('task_9'),
              stationId: STATION.stationId,
              unreplayableReason: null,
              reason: null,
              endedAt: NOW,
            },
          ],
          remove: [],
        },
        NOW,
        false,
      ),
    );
    const fourth = idOf(await start());
    expect(checkOf(fourth).attempt).toBe(4);
    expect(await start()).toEqual({ outcome: 'reused', id: fourth });
  });

  it('never points two checks at a baseline that will not exist: the second waits for the first one’s, and both compare against it', async () => {
    keptAtStation();
    const one = idOf(await start());
    work.validate = async (_line, _station, block) => ({
      ok: true,
      fingerprint: PLANNED,
      hashes: StationHashes.of({
        behaviour: '5'.repeat(64),
        scoring: '6'.repeat(64),
      }),
      liveHashes: LIVE_HASHES,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    });
    const two = idOf(await start({ ...PLAN, prompt: 'Build it twice.' }));

    expect(wantedBaselines()).toHaveLength(2);
    expect((await read(two)).result).toBe('running');

    await startingBaselines();

    const baselines = [...memory.replays.values()].filter(
      (each) => each.baseline,
    );
    expect(baselines).toHaveLength(1);
    expect(baselines[0]?.unpricedRate?.amount).toBe(2.5);
    expect((await read(one)).baselineReplayId).toBe(baselines[0]?.id.value);
    expect((await read(two)).baselineReplayId).toBe(baselines[0]?.id.value);

    await finished((baselines[0] as Replay).id);
    await finished(checkOf(two).replayId, false);
    expect((await read(two)).result).toBe('failed');
  });

  it('wants a new baseline when the set’s baseline replayed a live config that has since changed', async () => {
    const set = keptAtStation();
    const stale = memory.candidates.size;
    const old = await snapshotsFor(memory, work).taken(set);
    const staleLive = Replay.start({
      id: ReplayId.of('replay_stale'),
      set,
      candidate: {
        id: old.id,
        isLive: true,
        isOracle: false,
        basedOn: old.basedOn,
        judges: false,
        checksChanges: true,
        rubricVersion: null,
        scoringHash: '9'.repeat(64),
        isFor: () => true,
      },
      baseline: true,
      ceiling: Money.ceiling(5, 'USD'),
      at: NOW,
      by: BY,
    });
    staleLive.pullEvents();
    memory.replays.set(
      'replay_stale',
      replayedAs(staleLive, () => 'completed'),
    );

    const id = idOf(await start());

    expect(stale).toBe(0);
    expect(wantedBaselines()).toHaveLength(1);
    expect((await read(id)).baselineReplayId).toBeNull();
  });

  it('rejects a line with no replay_check, and a station with no replay set yet', async () => {
    keptAtStation();
    work.threshold = null;
    expect(await errorOf(start())).toBe('conflict');

    work.threshold = threshold(0);
    memory.sets.clear();
    expect(await errorOf(start())).toBe('conflict');
    expect(checks.stored.size).toBe(0);
  });

  it('names each problem of a planned station the line would not take', async () => {
    keptAtStation();
    const problem = ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['station', 'effort']),
      reason: 'is low, medium, high, xhigh or max',
    });
    work.validate = async () => ({ ok: false, problems: [problem] });

    expect(await start()).toEqual({ outcome: 'invalid', problems: [problem] });
  });

  it('says there is nothing to replay when the plan changes nothing about how the station runs', async () => {
    keptAtStation();
    work.validate = async (_line, _station, block) => ({
      ok: true,
      fingerprint: LIVE_FINGERPRINT,
      hashes: LIVE_HASHES,
      liveHashes: LIVE_HASHES,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    });

    expect(await start()).toEqual({
      outcome: 'unchanged',
      scoringPinnedToLive: ['check', 'runners'],
    });
  });

  it('lets only those who may plan start a check', async () => {
    keptAtStation();
    expect(await start(PLAN, false)).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
  });
});

describe('EnsureCheckBaselines', () => {
  const ensuring = () =>
    new EnsureCheckBaselines(
      checks,
      evaluations(),
      memory.setRepository,
      memory.replayRepository,
      work,
      snapshotsFor(memory, work),
      IDS,
      CLOCK,
      TRANSACTION,
      QUIET,
    ).processDue();

  const baselines = () =>
    [...memory.replays.values()].filter((each) => each.baseline);

  it('starts the baseline a check waits for when the one it wanted never came, then notes it found one', async () => {
    keptAtStation();
    const id = idOf(await start());

    expect(baselines()).toHaveLength(0);

    await ensuring();
    expect(baselines()).toHaveLength(1);
    expect(baselines()[0]?.ceiling.amount).toBe(7.5);
    expect(checkOf(id).baseline).toBe('awaiting');

    await ensuring();
    expect(checkOf(id).baseline).toBe('found');
    expect(baselines()).toHaveLength(1);
    expect((await read(id)).baselineReplayId).toBe(baselines()[0]?.id.value);
  });

  it('gives up on a baseline once the live config has moved on before one came, leaving the check undecided', async () => {
    keptAtStation();
    const id = idOf(await start());
    const live = await work.live();
    work.live = async () => ({
      ...live,
      hashes: StationHashes.of({
        behaviour: '7'.repeat(64),
        scoring: '8'.repeat(64),
      }),
    });

    await ensuring();
    await finished(checkOf(id).replayId);

    expect(baselines()).toHaveLength(0);
    expect(checkOf(id).baseline).toBe('unavailable');
    expect(await read(id)).toMatchObject({
      result: 'undecided',
      undecidedBecause: 'no-baseline',
    });
  });

  it('is undecided once the baseline it found is gone', async () => {
    keptAtStation();
    const id = idOf(await start());

    await ensuring();
    await ensuring();
    memory.replays.delete(baselines()[0]?.id.value ?? '');
    await finished(checkOf(id).replayId);

    expect(await read(id)).toMatchObject({
      result: 'undecided',
      undecidedBecause: 'no-baseline',
    });
  });
});

describe('ReadReplayCheckHandler', () => {
  it('reads a running check to any reader of the team, linking its replay in the web app', async () => {
    keptAtStation();
    const id = idOf(await start());
    const check = checkOf(id);

    expect(await read(id)).toMatchObject({
      result: 'running',
      undecidedBecause: null,
      attempt: 1,
      baselineReplayId: null,
      threshold: {
        maxRegressions: 1,
        ceiling: { amount: 7.5, currency: 'USD' },
      },
      reference: { commit: null, pullRequest: 42 },
      scoringPinnedToLive: ['check', 'runners'],
      tasks: 3,
      replayUrl: `https://app.example.test/w/acme/team/${STATION.teamId.value}/lines/line_1/stations/${STATION.stationId}/replays/${check.replayId.value}`,
    });
  });

  it('finds no check for one off the team', async () => {
    keptAtStation();
    const id = idOf(await start());

    expect(await errorOf(read(id, null))).toBe('not-found');
  });
});

describe('ListSetReplayChecksHandler', () => {
  const list = (
    before: string | null,
    limit: number,
    mayPlan: boolean | null = false,
  ) =>
    new ListSetReplayChecksHandler(
      accessFor(memory, work, mayPlan),
      peopleWho(mayPlan),
      checks,
      evaluations(),
      'https://app.example.test',
    ).execute(
      new ListSetReplayChecksQuery('team_1', 'set_1', PERSON, {
        before,
        limit,
      }),
    );

  it('lists a set’s checks newest first, a page at a time, each with its result, to any reader of the team', async () => {
    keptAtStation();
    const first = idOf(await start());
    work.validate = async (_line, _station, block) => ({
      ok: true,
      fingerprint: PLANNED,
      hashes: StationHashes.of({
        behaviour: '5'.repeat(64),
        scoring: '6'.repeat(64),
      }),
      liveHashes: LIVE_HASHES,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    });
    const second = idOf(await start({ ...PLAN, prompt: 'Build it again.' }));

    const page = await list(null, 1);
    expect(page).toEqual([
      expect.objectContaining({
        id: second,
        stationKey: 'build',
        result: 'running',
        regressions: 0,
        attempt: 1,
        reference: { commit: null, pullRequest: 42 },
        replayUrl: expect.stringContaining('https://app.example.test/w/acme/'),
      }),
    ]);
    expect((await list(second, 5)).map((each) => each.id)).toEqual([first]);
    expect(await errorOf(list(null, 5, null))).toBe('not-found');
  });
});

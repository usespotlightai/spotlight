import { GuardChangesCommand } from '@replays/application/commands/guard-changes.command';
import { GuardChangesHandler } from '@replays/application/commands/handlers/guard-changes.handler';
import { StartReplayCheckHandler } from '@replays/application/commands/handlers/start-replay-check.handler';
import { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import type { ReplayCheckStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import { ListSetReplayChecksHandler } from '@replays/application/queries/handlers/list-set-replay-checks.handler';
import { ReadReplayCheckHandler } from '@replays/application/queries/handlers/read-replay-check.handler';
import { ListSetReplayChecksQuery } from '@replays/application/queries/list-set-replay-checks.query';
import { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import { CheckReadings } from '@replays/application/services/check-readings.service';
import { EnsureCheckBaselines } from '@replays/application/services/ensure-check-baselines.service';
import {
  ACTOR,
  accessFor,
  CLOCK,
  FakeWork,
  IDS,
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
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { ReplaySetGuardChanged } from '@replays/domain/events/replay-set-guard-changed.event';
import {
  aSet,
  BY,
  LIVE_DIGESTS,
  LIVE_FINGERPRINT,
  NOW,
  replayedAs,
  STATION,
  sha256,
} from '@replays/domain/replays.fake-spec';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const PLANNED = StationFingerprint.of('c'.repeat(64));

const PLANNED_DIGESTS = StationDigests.of({
  behaviour: '3'.repeat(64),
  scoring: '4'.repeat(64),
});

const CHECKED = CandidateScoring.of({
  checksChanges: true,
  rubric: null,
  rubricVersion: null,
});

const FRESH: IdempotentCreatesPort = {
  claim: async () => ({ kind: 'fresh' }),
  created: async () => {},
};

const PLAN = {
  key: 'build',
  name: 'Build',
  kind: 'work',
  prompt: 'Build it carefully.',
  check: 'true',
  runners: ['gpu'],
};

const threshold = (mostRegressions: number) =>
  ReplayThreshold.of({
    mostRegressions,
    ceiling: 7.5,
    currency: 'USD',
    minGain: 0.05,
  });

class InMemoryChecks implements ReplayCheckRepository {
  readonly held = new Map<string, ReplayCheck>();

  find = async (id: { value: string }) => this.held.get(id.value) ?? null;

  matching = async (
    stationId: string,
    candidate: StationDigests,
    live: StationDigests,
  ) =>
    [...this.held.values()].filter(
      (each) =>
        each.station.stationId === stationId &&
        each.candidateDigests.behaviour === candidate.behaviour &&
        each.liveDigests.scoring === live.scoring,
    );

  awaitingBaseline = async () =>
    [...this.held.values()].filter((each) => each.awaitsBaseline);

  ofTeam = async () => [...this.held.values()];

  ofSet = async () => [...this.held.values()];

  pageOfSet = async (
    _setId: unknown,
    page: { before: { value: string } | null; limit: number },
  ) => {
    const newest = [...this.held.values()].reverse();
    const from = page.before
      ? newest.findIndex((each) => each.id.value === page.before?.value) + 1
      : 0;

    return page.before && from === 0
      ? []
      : newest.slice(from, from + page.limit);
  };

  add = async (check: ReplayCheck) => {
    memory.events.push(...check.pullEvents());
    this.held.set(check.id.value, check);
  };

  save = async (check: ReplayCheck) => {
    if (check.isAbandoned) {
      this.held.delete(check.id.value);
    } else {
      this.held.set(check.id.value, check);
    }
  };
}

let memory: InMemoryReplays;
let work: FakeWork;
let checks: InMemoryChecks;
let examined: { block: unknown; line: unknown }[];

const faultOf = async (asked: Promise<unknown>) =>
  asked.then(
    () => {
      throw new Error('it was allowed');
    },
    (error: unknown) => {
      if (error instanceof UseCaseFault) {
        return error.kind;
      }
      throw error;
    },
  );

const atVersion = (set: ReplaySet, version: number): ReplaySet =>
  ReplaySet.rehydrate({
    id: set.id,
    station: set.station,
    name: set.name,
    entries: set.entries,
    guardsChanges: set.guardsChanges,
    createdAt: set.createdAt,
    stationGoneAt: set.stationGoneAt,
    version,
  });

const guarding = (set: ReplaySet = aSet(3)): ReplaySet => {
  const guards = set.guardingChanges([], BY);

  guards.pullEvents();
  memory.sets.set(guards.id.value, guards);

  return guards;
};

const readings = () =>
  new CheckReadings(memory.replayRepository, memory.setRepository);

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
    readings(),
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
    readings(),
    'https://app.example.test/',
  ).execute(new ReadReplayCheckQuery('team_1', id, PERSON));

const idOf = (started: ReplayCheckStartedOutcome): string => {
  if (started.outcome !== 'created') {
    throw new Error(`it was ${started.outcome}`);
  }

  return started.id;
};

const checkOf = (id: string): ReplayCheck => checks.held.get(id) as ReplayCheck;

const wantedBaselines = () =>
  memory.events.filter(
    (each): each is ReplayBaselineWanted =>
      each instanceof ReplayBaselineWanted,
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
    await starting.wanted(each);
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
  checks = new InMemoryChecks();
  examined = [];
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
    digests: LIVE_DIGESTS,
    threshold: work.threshold,
  });
  work.examine = async (_line, _station, block, line) => {
    examined.push({ block, line: line?.value ?? null });
    return {
      ok: true,
      fingerprint: PLANNED,
      digests: PLANNED_DIGESTS,
      liveDigests: LIVE_DIGESTS,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    };
  };
});

describe('StartReplayCheckHandler', () => {
  it('replays a planned change over the guarding set, scored and placed as the live station is, under the live line’s threshold, wanting a baseline', async () => {
    const set = guarding();
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

    expect(examined).toEqual([
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
    expect(check.keptLive).toEqual(['check', 'runners']);
    expect(check.attempt).toBe(1);
    expect(check.setEntries).toBe(
      sha256(
        set.runs
          .map((each) => each.value)
          .sort()
          .join('\n'),
      ),
    );
    expect(check.threshold.mostRegressions).toBe(1);
    expect(replay?.ceiling.amount).toBe(7.5);
    expect(replay?.unpricedRate?.amount).toBe(2.5);
    expect(wantedBaselines()[0]?.unpricedRate?.amount).toBe(2.5);
    expect(replay?.scoringDigest).toBe(PLANNED_DIGESTS.scoring);
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
    const set = guarding();
    const first = idOf(await start());

    expect(await start()).toEqual({ outcome: 'reused', id: first });

    memory.sets.set(set.id.value, atVersion(set, set.version + 3));
    expect(await start()).toEqual({ outcome: 'reused', id: first });
    expect(checks.held.size).toBe(1);
  });

  it('starts another attempt once the earlier one is undecided, the threshold changed, or the set changed', async () => {
    const set = guarding();
    const first = idOf(await start());

    memory.replays.set(
      checkOf(first).replayId.value,
      (memory.replays.get(checkOf(first).replayId.value) as Replay).stopped(
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
      set.withEntry(
        {
          runId: RunId.of('original_9'),
          taskId: TaskId.of('task_9'),
          stationId: STATION.stationId,
          refusal: null,
          reason: null,
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
    guarding();
    const one = idOf(await start());
    work.examine = async (_line, _station, block) => ({
      ok: true,
      fingerprint: PLANNED,
      digests: StationDigests.of({
        behaviour: '5'.repeat(64),
        scoring: '6'.repeat(64),
      }),
      liveDigests: LIVE_DIGESTS,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    });
    const two = idOf(await start({ ...PLAN, prompt: 'Build it twice.' }));

    expect(wantedBaselines()).toHaveLength(2);
    expect((await read(two)).verdict).toBe('running');

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
    expect((await read(two)).verdict).toBe('failed');
  });

  it('wants a new baseline when the set’s baseline replayed a live config that has since changed', async () => {
    const set = guarding();
    const stale = memory.candidates.size;
    const old = await snapshotsFor(memory, work).taken(set);
    const staleLive = Replay.started({
      id: ReplayId.of('replay_stale'),
      set,
      candidate: {
        id: old.id,
        isLive: true,
        isSanity: false,
        judges: false,
        checksChanges: true,
        rubricVersion: null,
        scoringDigest: '9'.repeat(64),
        isFor: () => true,
      },
      baseline: true,
      ceiling: Spend.ceiling(5, 'USD'),
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

  it('refuses a line with no replay_check, and a station no set guards', async () => {
    guarding();
    work.threshold = null;
    expect(await faultOf(start())).toBe('conflict');

    work.threshold = threshold(0);
    memory.sets.clear();
    memory.sets.set(
      'set_2',
      ReplaySet.opened({
        id: ReplaySetId.of('set_2'),
        station: STATION,
        name: ReplaySetName.of('Unguarded'),
        at: new Date(),
      }),
    );
    expect(await faultOf(start())).toBe('conflict');
    expect(checks.held.size).toBe(0);
  });

  it('names each problem of a planned station the line would not take', async () => {
    guarding();
    const problem = ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['station', 'effort']),
      reason: 'is low, medium, high, xhigh or max',
    });
    work.examine = async () => ({ ok: false, problems: [problem] });

    expect(await start()).toEqual({ outcome: 'invalid', problems: [problem] });
  });

  it('says there is nothing to replay when the plan changes nothing about how the station runs', async () => {
    guarding();
    work.examine = async (_line, _station, block) => ({
      ok: true,
      fingerprint: LIVE_FINGERPRINT,
      digests: LIVE_DIGESTS,
      liveDigests: LIVE_DIGESTS,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    });

    expect(await start()).toEqual({
      outcome: 'unchanged',
      keptLive: ['check', 'runners'],
    });
  });

  it('lets only those who may plan start a check', async () => {
    guarding();
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
      readings(),
      memory.setRepository,
      memory.replayRepository,
      work,
      snapshotsFor(memory, work),
      IDS,
      CLOCK,
      TRANSACTION,
      QUIET,
    ).workDue();

  const baselines = () =>
    [...memory.replays.values()].filter((each) => each.baseline);

  it('starts the baseline a check waits for when the one it wanted never came, then notes it found one', async () => {
    guarding();
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
    guarding();
    const id = idOf(await start());
    const live = await work.live();
    work.live = async () => ({
      ...live,
      digests: StationDigests.of({
        behaviour: '7'.repeat(64),
        scoring: '8'.repeat(64),
      }),
    });

    await ensuring();
    await finished(checkOf(id).replayId);

    expect(baselines()).toHaveLength(0);
    expect(checkOf(id).baseline).toBe('unavailable');
    expect(await read(id)).toMatchObject({
      verdict: 'undecided',
      undecidedBecause: 'no-baseline',
    });
  });

  it('is undecided once the baseline it found is gone', async () => {
    guarding();
    const id = idOf(await start());

    await ensuring();
    await ensuring();
    memory.replays.delete(baselines()[0]?.id.value ?? '');
    await finished(checkOf(id).replayId);

    expect(await read(id)).toMatchObject({
      verdict: 'undecided',
      undecidedBecause: 'no-baseline',
    });
  });
});

describe('ReadReplayCheckHandler', () => {
  it('reads a running check to any reader of the team, linking its replay in the web app', async () => {
    guarding();
    const id = idOf(await start());
    const check = checkOf(id);

    expect(await read(id)).toMatchObject({
      verdict: 'running',
      undecidedBecause: null,
      setName: 'Queue fixes',
      attempt: 1,
      baselineReplayId: null,
      threshold: {
        mostRegressions: 1,
        ceiling: { amount: 7.5, currency: 'USD' },
      },
      reference: { commit: null, pullRequest: 42 },
      keptLive: ['check', 'runners'],
      tasks: 3,
      replayUrl: `https://app.example.test/w/acme/team/${STATION.teamId.value}/lines/line_1/stations/${STATION.stationId}/replays/${check.replayId.value}`,
    });
  });

  it('finds no check for one off the team', async () => {
    guarding();
    const id = idOf(await start());

    expect(await faultOf(read(id, null))).toBe('not-found');
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
      readings(),
      'https://app.example.test',
    ).execute(
      new ListSetReplayChecksQuery('team_1', 'set_1', PERSON, {
        before,
        limit,
      }),
    );

  it('lists a set’s checks newest first, a page at a time, each with its verdict, to any reader of the team', async () => {
    guarding();
    const first = idOf(await start());
    work.examine = async (_line, _station, block) => ({
      ok: true,
      fingerprint: PLANNED,
      digests: StationDigests.of({
        behaviour: '5'.repeat(64),
        scoring: '6'.repeat(64),
      }),
      liveDigests: LIVE_DIGESTS,
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
        verdict: 'running',
        regressions: 0,
        attempt: 1,
        reference: { commit: null, pullRequest: 42 },
        replayUrl: expect.stringContaining('https://app.example.test/w/acme/'),
      }),
    ]);
    expect((await list(second, 5)).map((each) => each.id)).toEqual([first]);
    expect(await faultOf(list(null, 5, null))).toBe('not-found');
  });
});

describe('GuardChangesHandler', () => {
  const guard = (setId: string, guards: boolean, mayPlan = true) =>
    new GuardChangesHandler(
      accessFor(memory, work, mayPlan),
      memory.setRepository,
      TRANSACTION,
    ).execute(new GuardChangesCommand('team_1', setId, guards, ACTOR));

  it('flags a set as guarding its station’s changes, and takes the flag back, recording who did', async () => {
    const set = aSet(2);
    memory.sets.set(set.id.value, set);

    expect(await guard(set.id.value, true)).toEqual({ outcome: 'changed' });
    expect(memory.sets.get(set.id.value)?.guardsChanges).toBe(true);
    expect(await guard(set.id.value, false)).toEqual({ outcome: 'changed' });
    expect(memory.sets.get(set.id.value)?.guardsChanges).toBe(false);

    const audited = memory.events.filter(
      (each): each is ReplaySetGuardChanged =>
        each instanceof ReplaySetGuardChanged,
    );
    expect(audited.map((each) => each.change.recordedDetail)).toEqual([
      { guardsChanges: true },
      { guardsChanges: false },
    ]);
    expect(audited[0]?.change.by.actor).toEqual(ACTOR);
  });

  it('refuses a second set guarding the same station', async () => {
    guarding();
    const other = ReplaySet.opened({
      id: ReplaySetId.of('set_2'),
      station: STATION,
      name: ReplaySetName.of('Other'),
      at: new Date(),
    });
    memory.sets.set('set_2', other);

    expect(await faultOf(guard('set_2', true))).toBe('conflict');
    expect(await guard('set_2', true, false)).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
  });
});

import { StartReplayCheckHandler } from '@replays/application/commands/handlers/start-replay-check.handler';
import { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import type { ReplayCheckStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import { ReadReplayCheckHandler } from '@replays/application/queries/handlers/read-replay-check.handler';
import { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import { EnsureCheckBaselines } from '@replays/application/services/ensure-check-baselines.service';
import {
  ACTOR,
  accessFor,
  CLOCK,
  FakeSuppliers,
  IDS,
  InMemoryChecks,
  InMemoryReplays,
  liveFrom,
  PERSON,
  peopleWho,
  QUIET,
  snapshotsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SearchReplaysToReuse } from '@replays/application/services/search-replays-to-reuse.service';
import { StartCheckReplays } from '@replays/application/services/start-check-replays.service';
import { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import { StopFailedChecks } from '@replays/application/services/stop-failed-checks.service';
import { StopSupersededChecks } from '@replays/application/services/stop-superseded-checks.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import {
  aSet,
  BY,
  candidateOf,
  HASHES,
  LIVE_FINGERPRINT,
  LIVE_HASHES,
  NOW,
  ranToEnd,
  replayedAs,
  replayFor,
  runIds,
  STATION,
  SEARCH_ID,
  sha256,
  slots,
} from '@replays/domain/replays.fake-spec';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { ReplayedCandidate } from '@replays/domain/value-objects/replayed-candidate.vo';
import { ScoringHash } from '@replays/domain/value-objects/scoring-hash.vo';
import { SetUsers } from '@replays/domain/value-objects/set-users.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { IdempotentLookupsPort } from '@shared-kernel/application/ports/idempotent-lookups.port';
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

const LOOKUPS: IdempotentLookupsPort = {
  lookup: async () => ({ kind: 'new' }),
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
let suppliers: FakeSuppliers;
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

const start = async (
  station: unknown = PLAN,
  mayPlan: boolean | null = true,
  line?: unknown,
  clock: ClockPort = CLOCK,
): Promise<ReplayCheckStartedOutcome> => {
  const outcome = await new StartReplayCheckHandler(
    accessFor(memory, suppliers, mayPlan),
    peopleWho(mayPlan),
    suppliers.configs,
    snapshotsFor(memory, suppliers),
    new StartCheckReplays(
      checks,
      memory.replayRepository,
      memory.candidateRepository,
      memory.setRepository,
      snapshotsFor(memory, suppliers),
      IDS,
      clock,
      TRANSACTION,
    ),
    evaluations(),
    new SearchReplaysToReuse(
      memory.replayRepository,
      memory.candidateRepository,
    ),
    memory.setRepository,
    checks,
    FRESH,
    LOOKUPS,
    { sha256 },
    IDS,
    clock,
    TRANSACTION,
    QUIET,
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

  for (const event of memory.events.slice()) {
    if (event instanceof ReplayCheckStarted) {
      await new StartCheckReplays(
        checks,
        memory.replayRepository,
        memory.candidateRepository,
        memory.setRepository,
        snapshotsFor(memory, suppliers),
        IDS,
        CLOCK,
        TRANSACTION,
      ).started(event);
    }
  }

  return outcome;
};

const read = (id: string, mayPlan: boolean | null = false) =>
  new ReadReplayCheckHandler(
    accessFor(memory, suppliers, mayPlan),
    suppliers.trialableRuns,
    checks,
    evaluations(),
  ).execute(new ReadReplayCheckQuery('team_1', id, PERSON));

const idOf = (started: ReplayCheckStartedOutcome): string => {
  if (started.outcome !== 'created') {
    throw new Error(`it was ${started.outcome}`);
  }

  return started.id;
};

const checkOf = (id: string): ReplayCheck =>
  checks.stored.get(id) as ReplayCheck;

const ownReplayOf = (id: string): ReplayId => checkOf(id).replayId as ReplayId;

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
  suppliers = new FakeSuppliers();
  checks = new InMemoryChecks(memory.events);
  validated = [];
  suppliers.lines.threshold = threshold(1);
  suppliers.configs.live = async () => ({
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
    threshold: suppliers.lines.threshold,
    search: null,
    agent: null,
  });
  suppliers.configs.validate = async (_line, _station, block, line) => {
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
    const replay = memory.replays.get(check.replayId?.value ?? '');
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
      ownReplayOf(first).value,
      (memory.replays.get(ownReplayOf(first).value) as Replay).stop(
        NOW,
        BY,
        'search-ended',
      ),
    );
    const second = idOf(await start());
    expect(second).not.toBe(first);
    expect(checkOf(second).attempt).toBe(2);

    suppliers.lines.threshold = threshold(3);
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
        SetUsers.none(),
      ),
    );
    const fourth = idOf(await start());
    expect(checkOf(fourth).attempt).toBe(4);
    expect(await start()).toEqual({ outcome: 'reused', id: fourth });
  });

  it('never points two checks at a baseline that will not exist: the second waits for the first one’s, and both compare against it', async () => {
    keptAtStation();
    const one = idOf(await start());
    suppliers.configs.validate = async (_line, _station, block) => ({
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

    await finished(baselines[0].id);
    await finished(ownReplayOf(two), false);
    expect((await read(two)).result).toBe('failed');
  });

  it('wants a new baseline when the set’s baseline replayed a live config that has since changed', async () => {
    const set = keptAtStation();
    const stale = memory.candidates.size;
    const old = await snapshotsFor(memory, suppliers).taken(set);
    const staleLive = Replay.start({
      id: ReplayId.of('replay_stale'),
      set: set.snapshot,
      candidate: ReplayedCandidate.of({
        id: old.id,
        stationId: set.station.stationId,
        isLive: true,
        isOracle: false,
        basedOn: old.basedOn,
        judges: false,
        checksChanges: true,
        rubricVersion: null,
        scoringHash: ScoringHash.of('9'.repeat(64)),
      }),
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
    suppliers.lines.threshold = null;
    expect(await errorOf(start())).toBe('conflict');

    suppliers.lines.threshold = threshold(0);
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
    suppliers.configs.validate = async () => ({
      ok: false,
      problems: [problem],
    });

    expect(await start()).toEqual({ outcome: 'invalid', problems: [problem] });
  });

  it('says there is nothing to replay when the plan changes nothing about how the station runs', async () => {
    keptAtStation();
    suppliers.configs.validate = async (_line, _station, block) => ({
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
      suppliers.configs,
      snapshotsFor(memory, suppliers),
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
    expect(baselines()[0]?.repeats).toBe(3);
    expect(baselines()[0]?.ceiling.amount).toBe(22.5);
    expect(checkOf(id).baseline).toBe('awaiting');

    await ensuring();
    expect(checkOf(id).baseline).toBe('found');
    expect(baselines()).toHaveLength(1);
    expect((await read(id)).baselineReplayId).toBe(baselines()[0]?.id.value);
  });

  it('gives up on a baseline once the live config has moved on before one came, leaving the check undecided', async () => {
    keptAtStation();
    const id = idOf(await start());
    const live = await liveFrom(suppliers.configs)();
    suppliers.configs.live = async () => ({
      ...live,
      hashes: StationHashes.of({
        behaviour: '7'.repeat(64),
        scoring: '8'.repeat(64),
      }),
    });

    await ensuring();
    await finished(ownReplayOf(id));

    expect(baselines()).toHaveLength(0);
    expect(checkOf(id).baseline).toBe('unavailable');
    expect(await read(id)).toMatchObject({
      result: 'undecided',
      undecidedBecause: 'no-baseline',
    });
  });

  it('starts no baseline for a check whose replay stopped, which reads as stopped', async () => {
    keptAtStation();
    const id = idOf(await start());
    const replay = memory.replays.get(ownReplayOf(id).value) as Replay;
    await memory.replayRepository.save(replay.stop(NOW, BY, 'search-ended'));

    await ensuring();

    expect(baselines()).toHaveLength(0);
    expect(checkOf(id).baseline).toBe('unavailable');
    expect(await read(id)).toMatchObject({
      result: 'undecided',
      undecidedBecause: 'stopped',
    });
  });

  it('is undecided once the baseline it found is gone', async () => {
    keptAtStation();
    const id = idOf(await start());

    await ensuring();
    await ensuring();
    memory.replays.delete(baselines()[0]?.id.value ?? '');
    await finished(ownReplayOf(id));

    expect(await read(id)).toMatchObject({
      result: 'undecided',
      undecidedBecause: 'no-baseline',
    });
  });
});

describe('ReadReplayCheckHandler', () => {
  it('reads a running check to any reader of the team, with each task of the set and why it stands where it does', async () => {
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
      taskCount: 3,
    });
    expect(check.replayId?.value).toBeTruthy();
    expect((await read(id)).tasks).toEqual([
      expect.objectContaining({
        regressed: false,
        live: { result: 'absent', successRate: null, reason: 'Not replayed.' },
        candidate: {
          result: 'pending',
          successRate: null,
          reason: 'The replay has not finished.',
        },
      }),
      expect.anything(),
      expect.anything(),
    ]);
    expect(await read(id)).not.toHaveProperty('replayUrl');
  });

  it('finds no check for one off the team', async () => {
    keptAtStation();
    const id = idOf(await start());

    expect(await errorOf(read(id, null))).toBe('not-found');
  });
});

describe('StopSupersededChecks', () => {
  const LATER: ClockPort = {
    now: () => new Date(NOW.getTime() + 60_000),
    sleep: async () => {},
  };

  const plannedAs = (hashes: StationHashes) => {
    suppliers.configs.validate = async (_line, _station, block) => ({
      ok: true,
      fingerprint: PLANNED,
      hashes,
      liveHashes: LIVE_HASHES,
      scoring: CHECKED,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      block: StationBlock.of(block),
    });
  };

  const stoppingSuperseded = async () => {
    const stopping = new StopSupersededChecks(
      checks,
      memory.replayRepository,
      CLOCK,
      TRANSACTION,
    );

    for (const event of memory.events.slice()) {
      if (event instanceof ReplayCheckStarted) {
        await stopping.started(event);
      }
    }
  };

  const replayOf = (id: string) =>
    memory.replays.get(ownReplayOf(id).value) as Replay;

  it('stops the replay of an earlier check of the same pull request once a later change of it starts a check', async () => {
    keptAtStation();
    const earlier = idOf(await start());

    plannedAs(
      StationHashes.of({ behaviour: '5'.repeat(64), scoring: '4'.repeat(64) }),
    );
    const later = idOf(
      await start(
        { ...PLAN, prompt: 'Build it well.' },
        true,
        undefined,
        LATER,
      ),
    );

    await stoppingSuperseded();

    expect(replayOf(earlier).current).toBe('stopped');
    expect(replayOf(later).current).not.toBe('stopped');
    expect(await read(earlier)).toMatchObject({
      result: 'undecided',
      undecidedBecause: 'stopped',
      candidate: { stoppedBecause: 'superseded' },
    });
    expect((await read(later)).candidate.stoppedBecause).toBeNull();
  });

  it('keeps an earlier check of the same pull request whose change is the same', async () => {
    keptAtStation();
    const only = idOf(await start());

    await stoppingSuperseded();

    expect(replayOf(only).current).not.toBe('stopped');
  });
});

describe('StartReplayCheckHandler, after a search', () => {
  const searched = (
    set: ReplaySet,
    subsets: readonly (readonly RunId[])[],
  ): void => {
    memory.candidates.set('candidate_live', candidateOf('live'));
    memory.candidates.set('candidate_searched', candidateOf('searched'));
    memory.replays.set(
      'replay_seed',
      replayedAs(
        replayFor(set, 'replay_seed', 'candidate_live', null, true, 3),
        () => 'completed',
      ),
    );
    subsets.forEach((runs, index) =>
      memory.replays.set(
        `replay_searched_${index}`,
        replayedAs(
          replayFor(
            set,
            `replay_searched_${index}`,
            'candidate_searched',
            runs,
            false,
            1,
            SEARCH_ID,
            'replay_seed',
          ),
          () => 'completed',
        ),
      ),
    );
  };

  const plannedAsSearched = (): void => {
    const planned = suppliers.configs.validate;

    suppliers.configs.validate = async (...input) => {
      const found = await planned(...input);

      return found?.ok ? { ...found, hashes: HASHES } : found;
    };
  };

  beforeEach(plannedAsSearched);

  it('takes a search’s replays of the same config as its result, against the search’s seed, and replays nothing once they cover every run', async () => {
    const set = keptAtStation();
    const [first, second, third] = set.runs as [RunId, RunId, RunId];
    searched(set, [[first, second], [third]]);
    const before = memory.replays.size;

    const id = idOf(await start());
    const check = checkOf(id);
    const shown = await read(id);

    expect(check.replayId).toBeNull();
    expect(check.reused?.seed.value).toBe('replay_seed');
    expect(check.reused?.runs.map((each) => each.value).sort()).toEqual(
      set.runs.map((each) => each.value).sort(),
    );
    expect(memory.replays.size).toBe(before);
    expect(wantedBaselines()).toHaveLength(0);
    expect(shown.result).toBe('passed');
    expect(shown.baselineReplayId).toBe('replay_seed');
    expect([...shown.reusedReplayIds].sort()).toEqual([
      'replay_searched_0',
      'replay_searched_1',
    ]);
    expect(shown.tasks).toHaveLength(3);
    expect(shown.candidate.spent?.amount).toBe(0);
  });

  it('replays only the runs no search replayed, against the search’s seed', async () => {
    const set = keptAtStation();
    const [first, second, third] = set.runs as [RunId, RunId, RunId];
    searched(set, [[first, second]]);

    const id = idOf(await start());
    const own = memory.replays.get(ownReplayOf(id).value) as Replay;

    expect(own.runSubset?.map((each) => each.value)).toEqual([third.value]);
    expect(own.pairwiseReferenceId?.value).toBe('replay_seed');
    expect(wantedBaselines()).toHaveLength(0);
    expect((await read(id)).result).toBe('running');

    await finished(own.id);

    const shown = await read(id);

    expect(shown.result).toBe('passed');
    expect(shown.taskCount).toBe(3);
  });

  it('answers with the search’s replays rather than an earlier check of the change that replayed it afresh', async () => {
    const set = keptAtStation();
    suppliers.lines.threshold = threshold(0);
    const fresh = idOf(await start());

    await startingBaselines();
    for (const each of [...memory.replays.values()].filter(
      (replay) => replay.baseline,
    )) {
      await finished(each.id);
    }
    await finished(ownReplayOf(fresh), false);
    expect((await read(fresh)).result).toBe('failed');

    searched(set, [set.runs]);
    const again = idOf(await start());

    expect(again).not.toBe(fresh);
    expect(checkOf(again).attempt).toBe(2);
    expect((await read(again)).result).toBe('passed');
  });
});

describe('StopFailedChecks', () => {
  it('stops the rest of a check’s replay once more tasks regressed than its threshold allows', async () => {
    suppliers.lines.threshold = threshold(0);
    const set = keptAtStation();
    const id = idOf(await start());

    await startingBaselines();
    const baseline = [...memory.replays.values()].find(
      (each) => each.baseline,
    ) as Replay;
    await finished(baseline.id);

    const own = (memory.replays.get(ownReplayOf(id).value) as Replay).reserving(
      slots(set.runs.length),
      runIds(),
    );
    const [entry] = own.entries;
    const run = entry?.run as RunId;
    memory.replays.set(own.id.value, ranToEnd(own, run, 'failed', 1));

    await new StopFailedChecks(
      checks,
      memory.replayRepository,
      evaluations(),
      CLOCK,
      TRANSACTION,
    ).concluded(new ReplayEntryConcluded(own.id, set.workspaceId, set.id, run));

    const stopped = memory.replays.get(own.id.value) as Replay;

    expect(stopped.wasStopped).toBe(true);
    expect(stopped.stoppedBecause).toBe('check-failed');
    expect((await read(id)).result).toBe('failed');
  });
});

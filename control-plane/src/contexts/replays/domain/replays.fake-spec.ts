import { createHash } from 'node:crypto';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import {
  type ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { RunResult } from '@replays/domain/value-objects/replay-ending';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const NOW = new Date('2026-10-01T09:00:00.000Z');

export const later = (ms: number): Date => new Date(NOW.getTime() + ms);

export const STATION: ReplayedStation = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  lineId: 'line_1',
  stationId: 'station_build',
};

export const FINGERPRINT = StationFingerprint.of('a'.repeat(64));

export const LIVE_FINGERPRINT = StationFingerprint.of('b'.repeat(64));

export const HASHES = StationHashes.of({
  behaviour: '1'.repeat(64),
  scoring: '2'.repeat(64),
});

export const LIVE_HASHES = StationHashes.of({
  behaviour: 'd'.repeat(64),
  scoring: 'e'.repeat(64),
});

export const AT = StationPath.of('core', 'delivery', 'build') as StationPath;

export const BY = changeActorIn(STATION.workspaceId);

const versionOf = (text: string): string => {
  let hash = 0;

  for (const each of text) {
    hash = (hash * 31 + each.charCodeAt(0)) >>> 0;
  }

  return hash.toString(16).padStart(64, '0');
};

export const UNSCORED = CandidateScoring.of({
  checksChanges: false,
  judge: null,
  rubricVersion: null,
});

export const RUBRIC =
  'scores: 1-5\nDid it drain the queue without dropping a job?';

export const candidateOf = (
  kind: 'live' | 'proposed',
  id = `candidate_${kind}`,
  rubric: string | JudgeCriteria | null = null,
  check: string | null = null,
  fingerprint = FINGERPRINT,
): Candidate => {
  const judge =
    typeof rubric === 'string'
      ? JudgeCriteria.of({ rubric, claims: [], passThreshold: 1 })
      : rubric;
  const made = {
    id: CandidateId.of(id),
    station: STATION,
    address: AT,
    block: StationBlock.of({
      key: 'build',
      name: 'Build',
      kind: 'work',
      ...(judge
        ? {
            judge: {
              ...(judge.rubric === null ? {} : { rubric: judge.rubric }),
              ...(judge.claims.length > 0
                ? {
                    claims: [...judge.claims],
                    passThreshold: judge.passThreshold,
                  }
                : {}),
              sample: 0.1,
              minAgreement: 0.6,
            },
          }
        : {}),
      ...(check ? { diffs: true, check } : {}),
    }),
    fingerprint,
    hashes: kind === 'live' ? LIVE_HASHES : HASHES,
    scoring: CandidateScoring.of({
      checksChanges: check !== null,
      judge,
      rubricVersion: judge
        ? versionOf(
            JSON.stringify({
              rubric: judge.rubric,
              claims: judge.claims,
              passThreshold: judge.passThreshold,
            }),
          )
        : null,
    }),
    at: NOW,
  };

  return kind === 'live'
    ? Candidate.live(made)
    : Candidate.propose({
        ...made,
        name: CandidateName.of('Shorter prompt'),
        changedFrom: StationChanges.of(LIVE_FINGERPRINT, [
          {
            part: 'prompt',
            name: null,
            kind: 'changed',
            was: null,
            now: null,
          },
        ]),
        by: BY,
      });
};

export const aSet = (count = 0, id = 'set_1'): ReplaySet => {
  const kept = ReplaySet.create({
    id: ReplaySetId.of(id),
    station: STATION,
    at: NOW,
  });

  return count === 0
    ? kept
    : kept.refresh(
        {
          add: Array.from({ length: count }, (_, at) => ({
            runId: RunId.of(`original_${at}`),
            taskId: TaskId.of(`task_${at}`),
            stationId: STATION.stationId,
            unreplayableReason: null,
            reason: null,
            endedAt: NOW,
          })),
          remove: [],
        },
        NOW,
        false,
      );
};

export const aCheck = (setId = ReplaySetId.of('set_1')): ReplayCheck =>
  ReplayCheck.start({
    id: ReplayCheckId.of('check_1'),
    station: STATION,
    stationKey: 'build',
    setId,
    candidateId: CandidateId.of('candidate_planned'),
    replayId: ReplayId.of('replay_1'),
    setEntries: 'entries_1',
    attempt: 1,
    reference: PlannedReference.of({ pullRequest: 42 }),
    liveFingerprint: LIVE_FINGERPRINT,
    candidateFingerprint: FINGERPRINT,
    liveHashes: LIVE_HASHES,
    candidateHashes: HASHES,
    threshold: ReplayThreshold.of({
      maxRegressions: 0,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    }),
    repeats: 1,
    scoringPinnedToLive: ['diffs', 'check'],
    createdAt: NOW,
    by: BY,
  });

let next = 0;

export const runIds = (): (() => RunId) => {
  next = 0;
  return () => RunId.of(`replay_run_${next++}`);
};

export const aReplay = (
  input: {
    id?: string;
    count?: number;
    ceiling?: number;
    candidate?: Candidate;
    baseline?: boolean;
    at?: Date;
    runSubset?: readonly RunId[];
    searchId?: SearchId;
    repeats?: number;
    calibration?: boolean;
    pairwiseReferenceId?: string;
  } = {},
): Replay => {
  const started = Replay.start({
    id: ReplayId.of(input.id ?? 'replay_1'),
    set: aSet(input.count ?? 3),
    candidate: input.candidate ?? candidateOf('proposed'),
    baseline: input.baseline ?? false,
    ceiling: Money.ceiling(input.ceiling ?? 10, 'USD'),
    at: input.at ?? NOW,
    by: BY,
    ...(input.runSubset ? { runSubset: input.runSubset } : {}),
    ...(input.searchId ? { searchId: input.searchId } : {}),
    ...(input.repeats === undefined ? {} : { repeats: input.repeats }),
    ...(input.calibration ? { calibration: true } : {}),
    ...(input.pairwiseReferenceId
      ? { pairwiseReferenceId: ReplayId.of(input.pairwiseReferenceId) }
      : {}),
  });

  started.pullEvents();

  return started;
};

export const endOf = (
  result: RunResult,
  more: Partial<{
    stopped: boolean;
    asked: boolean;
    failure: string | null;
  }> = {},
): RunEnd =>
  RunEnd.of({
    result,
    failure:
      more.failure !== undefined
        ? more.failure
        : result === 'failed'
          ? 'exited'
          : null,
    stopped: more.stopped ?? false,
    asked: more.asked ?? false,
    next: result === 'completed' ? 'ship' : null,
    at: later(60_000),
  });

export const measuresOf = (
  cost: number | null,
  ms = 60_000,
  steps = 10,
  currency = 'USD',
  changedLines = 4,
): EntryMeasures =>
  EntryMeasures.of({
    ms,
    steps,
    changedLines,
    cost: cost === null ? null : Money.of(cost, currency),
    tokens: { input: 100, output: 50, cacheRead: null, cacheWrite: null },
  });

export const ranToEnd = (
  replay: Replay,
  run: RunId,
  result: RunResult,
  cost: number | null,
): Replay =>
  replay
    .confirm(run, FINGERPRINT, NOW)
    .recordRunEnd(run, endOf(result))
    .recordReview(run, ChangeChecks.of([]), null, later(60_000))
    .measure(run, measuresOf(cost), later(61_000));

export const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

export const SEARCH_ID = SearchId.of('search_1');

export const AGENT = SearchAgent.of({
  harness: 'claude-code',
  model: 'opus',
  effort: 'high',
});

export const aBudget = (
  input: Partial<{
    iterations: number;
    perIteration: number;
    ceiling: number;
    concurrency: number;
    repeats: number;
  }> = {},
): SearchBudget =>
  SearchBudget.of({
    iterations: input.iterations ?? 3,
    perIteration: input.perIteration ?? 2,
    ceiling: Money.ceiling(input.ceiling ?? 100, 'USD'),
    ...(input.concurrency ? { concurrency: input.concurrency } : {}),
    ...(input.repeats ? { repeats: input.repeats } : {}),
  });

export const aSearch = (
  input: {
    id?: string;
    count?: number;
    budget?: SearchBudget;
    set?: ReplaySet;
    objective?: SearchObjective;
  } = {},
): Search => {
  const set = input.set ?? aSet(input.count ?? 10);
  const id = input.id ? SearchId.of(input.id) : SEARCH_ID;
  const started = Search.start({
    id,
    set,
    agent: AGENT,
    budget: input.budget ?? aBudget(),
    objective: input.objective ?? 'success',
    split: HeldOutSplit.drawn({
      searchId: id,
      entries: set.entries,
      hash: sha256,
    }),
    seed: {
      candidate: candidateOf('live'),
      replayId: ReplayId.of('replay_seed'),
    },
    at: NOW,
    by: BY,
  });

  started.pullEvents();

  return started;
};

let nextSearchRun = 0;

export const searchRunIds = (): (() => RunId) => {
  nextSearchRun = 0;
  return () => RunId.of(`search_run_${++nextSearchRun}`);
};

const PASSED = ChangeChecks.of([
  {
    repository: 'api',
    state: 'passed',
    skip: null,
    failedAt: [],
    spent: ModelSpent.of([], 0),
  },
]);

export const replayFor = (
  set: ReplaySet,
  id: string,
  candidateId: string,
  runSubset: readonly RunId[] | null,
  live = false,
  repeats = 1,
  searchId: SearchId | null = SEARCH_ID,
  pairwiseReferenceId: string | null = null,
): Replay => {
  const started = Replay.start({
    id: ReplayId.of(id),
    set,
    candidate: candidateOf(live ? 'live' : 'proposed', candidateId),
    baseline: live,
    ceiling: Money.ceiling(100, 'USD'),
    at: NOW,
    by: BY,
    ...(searchId ? { searchId } : {}),
    repeats,
    ...(runSubset ? { runSubset } : {}),
    ...(pairwiseReferenceId
      ? { pairwiseReferenceId: ReplayId.of(pairwiseReferenceId) }
      : {}),
  });

  started.pullEvents();

  return started;
};

export const replayedAs = (
  replay: Replay,
  outcomeOf: (original: string, repeat: number) => RunResult,
  cost: number | null = 1,
  currency = 'USD',
): Replay => {
  const reserved = replay.reserving(replay.entries.length, runIds());

  return reserved.entries.reduce((built, entry) => {
    const run = entry.run as RunId;

    return built
      .confirm(run, FINGERPRINT, NOW)
      .recordRunEnd(run, endOf(outcomeOf(entry.original.value, entry.repeat)))
      .recordReview(run, PASSED, null, later(60_000))
      .measure(run, measuresOf(cost, 60_000, 10, currency), later(61_000));
  }, reserved);
};

export const CONCLUDING_CHECKS = ChangeChecks.of([
  {
    repository: 'api',
    state: 'passed',
    skip: null,
    failedAt: [],
    spent: ModelSpent.of([], 0),
  },
]);

export const CONCLUDING_VERDICT = JudgeVerdict.of({
  scale: 'number',
  value: 4,
  claimResults: null,
  claims: [],
  passThreshold: 1,
  model: 'judge/model',
  referenced: true,
  reasons: [],
  guidance: null,
});

export const runOf = (replay: string, at: number) =>
  RunId.of(`${replay}_run_${at}`);

export const concludedAll = (
  replay: Replay,
  options: {
    changedLines?: number;
    judged?: boolean;
    judgingCost?: number;
  } = {},
): Replay => {
  let built = replay.reserving(
    replay.entries.length,
    (() => {
      let at = 0;
      return () => {
        const run = runOf(replay.id.value, at);
        at += 1;
        return run;
      };
    })(),
  );

  for (const entry of built.entries) {
    const run = entry.run as RunId;
    built = built
      .confirm(run, FINGERPRINT, NOW)
      .recordRunEnd(run, endOf('completed'))
      .measure(
        run,
        measuresOf(1, 60_000, 10, 'USD', options.changedLines ?? 4),
        later(61_000),
      )
      .recordReview(run, CONCLUDING_CHECKS, null, later(62_000));

    if (options.judged ?? true) {
      built = built.recordVerdict(
        run,
        CONCLUDING_VERDICT,
        options.judgingCost === undefined
          ? null
          : ModelSpent.of([Money.of(options.judgingCost, 'USD')], 0),
        later(63_000),
      );
    }
  }

  built.pullEvents();
  return built;
};

export const pairVerdictOf = (winner: 'run' | 'other' | 'tie'): PairVerdict =>
  PairVerdict.fromWinner({
    winner,
    model: 'judge/model',
    passes: [
      {
        runShownFirst: true,
        winner: winner === 'tie' ? 'run' : winner,
        reasons: [
          { text: 'It drains fast.', runHunks: ['a#1'], otherHunks: ['b#1'] },
        ],
      },
      {
        runShownFirst: false,
        winner: winner === 'tie' ? 'other' : winner,
        reasons: [],
      },
    ],
  });

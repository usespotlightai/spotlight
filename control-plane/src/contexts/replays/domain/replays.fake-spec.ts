import { createHash } from 'node:crypto';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  type ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import type { StretchStart } from '@replays/domain/services/stretch-starts';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateKind } from '@replays/domain/value-objects/candidate-kind';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import type { PossibleOrigin } from '@replays/domain/value-objects/config-origin.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import type { RunOutcome } from '@replays/domain/value-objects/replay-ending';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
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

export const DIGESTS = StationDigests.of({
  behaviour: '1'.repeat(64),
  scoring: '2'.repeat(64),
});

export const LIVE_DIGESTS = StationDigests.of({
  behaviour: 'd'.repeat(64),
  scoring: 'e'.repeat(64),
});

export const AT = StationAddress.of(
  'core',
  'delivery',
  'build',
) as StationAddress;

export const BY = attributedIn(STATION.workspaceId);

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
      ? JudgeCriteria.of({ rubric, claims: [], passShare: 1 })
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
                ? { claims: [...judge.claims], passShare: judge.passShare }
                : {}),
              sample: 0.1,
              trust: 0.6,
            },
          }
        : {}),
      ...(check ? { diffs: true, check } : {}),
    }),
    fingerprint,
    digests: kind === 'live' ? LIVE_DIGESTS : DIGESTS,
    scoring: CandidateScoring.of({
      checksChanges: check !== null,
      judge,
      rubricVersion: judge
        ? versionOf(
            JSON.stringify({
              rubric: judge.rubric,
              claims: judge.claims,
              passShare: judge.passShare,
            }),
          )
        : null,
    }),
    at: NOW,
  };

  return kind === 'live'
    ? Candidate.live(made)
    : Candidate.proposed({
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

export const candidateKindOf = (input: {
  kind: CandidateKind;
  id: string;
  at?: Date;
  stationId?: string;
  workspaceId?: WorkspaceId;
  fingerprint?: StationFingerprint;
}): Candidate => {
  const made = {
    id: CandidateId.of(input.id),
    station: {
      ...STATION,
      stationId: input.stationId ?? STATION.stationId,
      workspaceId: input.workspaceId ?? STATION.workspaceId,
    },
    address: AT,
    block: StationBlock.of({ key: 'build', name: 'Build', prompt: 'Go.' }),
    fingerprint: input.fingerprint ?? FINGERPRINT,
    digests: DIGESTS,
    scoring: UNSCORED,
    at: input.at ?? NOW,
  };
  const promptChanged = StationChanges.of(LIVE_FINGERPRINT, [
    { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
  ]);

  switch (input.kind) {
    case 'live':
      return Candidate.live(made);
    case 'proposed':
      return Candidate.proposed({
        ...made,
        name: CandidateName.of(`Proposed ${input.id}`),
        changedFrom: promptChanged,
        by: BY,
      });
    case 'searched':
      return Candidate.searched({
        ...made,
        name: input.id.replaceAll('_', '-'),
        changedFrom: promptChanged,
        search: {
          searchId: SEARCH_ID,
          iteration: 1,
          hypothesis: Hypothesis.of('A shorter prompt keeps it on task.'),
        },
      });
    case 'planned':
      return Candidate.planned({
        ...made,
        changedFrom: promptChanged,
        reference: PlannedReference.of({ pullRequest: 42 }),
        line: null,
      });
    case 'sanity':
      return Candidate.sanity({
        ...made,
        changedFrom: StationChanges.of(LIVE_FINGERPRINT, [
          {
            part: 'model',
            name: null,
            kind: 'changed',
            was: 'sonnet',
            now: 'opus',
          },
        ]),
      });
  }
};

const entriesOf = (count: number): ReplaySetEntry[] =>
  Array.from({ length: count }, (_, at) =>
    ReplaySetEntry.of({
      runId: RunId.of(`original_${at}`),
      taskId: TaskId.of(`task_${at}`),
      addedAt: NOW,
    }),
  );

export const aSet = (count = 0, id = 'set_1'): ReplaySet =>
  entriesOf(count).reduce(
    (set, entry) =>
      set.withEntry(
        {
          runId: entry.runId,
          taskId: entry.taskId,
          stationId: STATION.stationId,
          refusal: null,
          reason: null,
        },
        NOW,
        false,
      ),
    ReplaySet.opened({
      id: ReplaySetId.of(id),
      station: STATION,
      name: ReplaySetName.of('Queue fixes'),
      at: NOW,
    }),
  );

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
    among?: readonly RunId[];
    searchId?: SearchId;
    repeats?: number;
    probe?: boolean;
    pairsWith?: string;
  } = {},
): Replay => {
  const started = Replay.started({
    id: ReplayId.of(input.id ?? 'replay_1'),
    set: aSet(input.count ?? 3),
    candidate: input.candidate ?? candidateOf('proposed'),
    baseline: input.baseline ?? false,
    ceiling: Spend.ceiling(input.ceiling ?? 10, 'USD'),
    at: input.at ?? NOW,
    by: BY,
    ...(input.among ? { among: input.among } : {}),
    ...(input.searchId ? { searchId: input.searchId } : {}),
    ...(input.repeats === undefined ? {} : { repeats: input.repeats }),
    ...(input.probe ? { probe: true } : {}),
    ...(input.pairsWith ? { pairsWith: ReplayId.of(input.pairsWith) } : {}),
  });

  started.pullEvents();

  return started;
};

export const endOf = (
  outcome: RunOutcome,
  more: Partial<{
    stopped: boolean;
    asked: boolean;
    failure: string | null;
  }> = {},
): RunEnd =>
  RunEnd.of({
    outcome,
    failure:
      more.failure !== undefined
        ? more.failure
        : outcome === 'failed'
          ? 'exited'
          : null,
    stopped: more.stopped ?? false,
    asked: more.asked ?? false,
    next: outcome === 'completed' ? 'ship' : null,
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
    cost: cost === null ? null : Spend.of(cost, currency),
    tokens: { input: 100, output: 50, cacheRead: null, cacheWrite: null },
  });

export const settledAs = (
  replay: Replay,
  run: RunId,
  outcome: RunOutcome,
  cost: number | null,
): Replay =>
  replay
    .confirmed(run, FINGERPRINT, NOW)
    .ended(run, endOf(outcome))
    .reviewed(run, ChangeChecks.of([]), null, later(60_000))
    .measured(run, measuresOf(cost), later(61_000));

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
    ceiling: Spend.ceiling(input.ceiling ?? 100, 'USD'),
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
  const started = Search.started({
    id,
    set,
    agent: AGENT,
    budget: input.budget ?? aBudget(),
    objective: input.objective ?? 'success',
    split: HeldOutSplit.drawn({
      searchId: id,
      entries: set.entries,
      digest: sha256,
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
  among: readonly RunId[] | null,
  live = false,
  repeats = 1,
  searchId: SearchId | null = SEARCH_ID,
  pairsWith: string | null = null,
): Replay => {
  const started = Replay.started({
    id: ReplayId.of(id),
    set,
    candidate: candidateOf(live ? 'live' : 'proposed', candidateId),
    baseline: live,
    ceiling: Spend.ceiling(100, 'USD'),
    at: NOW,
    by: BY,
    ...(searchId ? { searchId } : {}),
    repeats,
    ...(among ? { among } : {}),
    ...(pairsWith ? { pairsWith: ReplayId.of(pairsWith) } : {}),
  });

  started.pullEvents();

  return started;
};

export const replayedAs = (
  replay: Replay,
  outcomeOf: (original: string, repeat: number) => RunOutcome,
  cost: number | null = 1,
  currency = 'USD',
): Replay => {
  const reserved = replay.reserving(replay.entries.length, runIds());

  return reserved.entries.reduce((held, entry) => {
    const run = entry.run as RunId;

    return held
      .confirmed(run, FINGERPRINT, NOW)
      .ended(run, endOf(outcomeOf(entry.original.value, entry.repeat)))
      .reviewed(run, PASSED, null, later(60_000))
      .measured(run, measuresOf(cost, 60_000, 10, currency), later(61_000));
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
  marks: null,
  claims: [],
  passShare: 1,
  model: 'judge/model',
  referenced: true,
  reasons: [],
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
  let held = replay.reserving(
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

  for (const entry of held.entries) {
    const run = entry.run as RunId;
    held = held
      .confirmed(run, FINGERPRINT, NOW)
      .ended(run, endOf('completed'))
      .measured(
        run,
        measuresOf(1, 60_000, 10, 'USD', options.changedLines ?? 4),
        later(61_000),
      )
      .reviewed(run, CONCLUDING_CHECKS, null, later(62_000));

    if (options.judged ?? true) {
      held = held.judged(
        run,
        CONCLUDING_VERDICT,
        options.judgingCost === undefined
          ? null
          : ModelSpent.of([Spend.of(options.judgingCost, 'USD')], 0),
        later(63_000),
      );
    }
  }

  held.pullEvents();
  return held;
};

export const pairVerdictOf = (winner: 'run' | 'against' | 'tie'): PairVerdict =>
  PairVerdict.fromWinner({
    winner,
    model: 'judge/model',
    readings: [
      {
        runShownFirst: true,
        winner: winner === 'tie' ? 'run' : winner,
        reasons: [
          { text: 'It drains fast.', runHunks: ['a#1'], againstHunks: ['b#1'] },
        ],
      },
      {
        runShownFirst: false,
        winner: winner === 'tie' ? 'against' : winner,
        reasons: [],
      },
    ],
  });

export const startAt = (
  at: Date,
  change: Partial<StretchStart> = {},
): StretchStart => ({
  runId: RunId.of(`run_at_${at.getTime()}`),
  stationId: STATION.stationId,
  fingerprint: FINGERPRINT,
  changedAt: at,
  ...change,
});

export const possibleOf = (
  ...candidates: readonly Candidate[]
): PossibleOrigin[] =>
  candidates.flatMap((each) =>
    each.possibleOrigin ? [each.possibleOrigin] : [],
  );

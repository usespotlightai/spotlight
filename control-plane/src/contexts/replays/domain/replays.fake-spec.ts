import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  type ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import type { RunOutcome } from '@replays/domain/value-objects/replay-ending';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
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
  rubric: null,
  rubricVersion: null,
});

export const RUBRIC =
  'scores: 1-5\nDid it drain the queue without dropping a job?';

export const candidateOf = (
  kind: 'live' | 'proposed',
  id = `candidate_${kind}`,
  rubric: string | null = null,
  check: string | null = null,
): Candidate => {
  const made = {
    id: CandidateId.of(id),
    station: STATION,
    address: AT,
    block: StationBlock.of({
      key: 'build',
      name: 'Build',
      kind: 'work',
      ...(rubric ? { judge: { rubric, sample: 0.1, trust: 0.6 } } : {}),
      ...(check ? { diffs: true, check } : {}),
    }),
    fingerprint: FINGERPRINT,
    scoring: CandidateScoring.of({
      checksChanges: check !== null,
      rubric,
      rubricVersion: rubric ? versionOf(rubric) : null,
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

const entriesOf = (count: number): ReplaySetEntry[] =>
  Array.from({ length: count }, (_, at) =>
    ReplaySetEntry.of({
      runId: RunId.of(`original_${at}`),
      taskId: TaskId.of(`task_${at}`),
      addedAt: NOW,
    }),
  );

export const aSet = (count = 0): ReplaySet =>
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
      ),
    ReplaySet.opened({
      id: ReplaySetId.of('set_1'),
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

import type {
  TaskResult,
  TaskRow,
  TaskSide,
} from '@replays/application/dto/task-rows.dto';
import type { Scoring } from '@replays/domain/services/entry-result';
import type { EntryComparison } from '@replays/domain/services/replay-results';
import type { CheckSkip } from '@replays/domain/value-objects/check-skip';
import type { Unjudged } from '@replays/domain/value-objects/entry-judging.vo';
import type {
  EntryReason,
  EntryReasonCode,
} from '@replays/domain/value-objects/entry-reason';
import type { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';

const MAX_REASON = 200;

const REASONS: Readonly<Record<EntryReasonCode, string>> = {
  unreplayable: 'Spotlight could not replay or start the run',
  'not-run': 'The run did not start',
  'run-failed': 'The run failed',
  'run-stopped': 'The replay stopped before the run finished',
  'asked-a-person': 'The run asked a person, and a replay cannot answer',
  'check-failed': 'Checks failed',
  'check-skipped': 'Checks could not run',
  'change-not-generated': 'Spotlight could not make the change',
  'no-change': 'The run changed no files for the checks',
  'no-change-stack': 'The change did not get to Spotlight',
  judged: 'Judge passed it',
  'judge-failed': 'Judge failed it',
  unjudged: 'Judge could not judge it',
  'nothing-judges': 'No check or judge scores this station',
};

const UNREPLAYABLE: Readonly<Record<UnreplayableReason, string>> = {
  'unknown-run': 'the run does not exist',
  'not-a-task-run': 'the run has no task',
  'task-gone': 'the task was deleted',
  'still-running': 'the run has not ended',
  'no-starting-point': 'the run recorded no starting point',
  'no-briefing': 'the task briefing was not kept',
  'archive-gone': 'the starting workspace is gone',
  'attachments-gone': 'the briefing files are gone',
  'answer-gone': 'the answer is gone',
  'repository-gone': 'the repository is not on the line',
  'not-at-the-station': 'the run was not at this station',
  'candidate-unfit': 'the candidate cannot run it',
  'cannot-start': 'the run could not start',
  unchecked: 'Spotlight could not check it',
  cancelled: 'the run did not start',
  'dispatch-failed': 'the run did not start after several tries',
};

const FAILURES: Readonly<Record<RunFailureCode, string>> = {
  exited: 'the agent stopped with an error',
  unprepared: 'the workspace setup failed before the agent started',
  refused: 'the config is not allowed in a replay',
  unprovisioned: 'no runner was available',
  'hooks-unanswered': 'hooks did not answer',
  'runner-lost': 'Spotlight lost the runner',
  'timed-out': 'the run went over the time limit of the host',
  cancelled: 'the run was cancelled before a runner claimed it',
  superseded: 'a newer run replaced it',
};

const CHECK_SKIPS: Readonly<Record<CheckSkip, string>> = {
  'no-base': 'the starting commit is missing',
  'no-checkout': 'the checkout is missing',
  'checkout-failed': 'the checkout failed',
  'setup-failed': 'the repository setup failed',
  'workspace-failed': 'the runner could not open a workspace',
  'out-of-time': 'the checks ran out of time',
  'no-image': 'the check image is missing',
  'provision-failed': 'no runner was available for the check',
  'queue-timeout': 'no runner claimed the check in time',
  skipped: 'the checks were skipped',
  'not-generated': 'the change was not made',
  'no-check-asked': 'the candidate has no check command',
};

const UNJUDGED: Readonly<Record<Unjudged, string>> = {
  unavailable: 'no judge model was available',
  'unreadable-rubric': 'the rubric could not be read',
  'no-evidence': 'there was nothing to judge',
  'request-failed': 'the judge request failed',
  unreadable: 'the answer of the judge could not be read',
  ungrounded: 'the judge cited nothing that the run did',
  errored: 'judging failed',
  interrupted: 'judging was interrupted',
  'stopped-before-judging': 'the replay stopped before judging',
};

const FALLBACKS: Readonly<Record<TaskResult, string>> = {
  succeeded: 'Checks passed.',
  failed: 'The run failed.',
  mixed: 'The repeats did not agree.',
  unscored: 'Nothing scored the run.',
  pending: 'The replay has not finished.',
  absent: 'Not replayed.',
};

const lookup = <T extends string>(
  table: Readonly<Record<T, string>>,
  code: string,
): string => (code in table ? table[code as T] : code);

const detailOf = (reason: EntryReason): string | null => {
  const { detail } = reason;

  if (!detail) {
    return null;
  }

  switch (reason.code) {
    case 'unreplayable':
    case 'not-run':
      return lookup(UNREPLAYABLE, detail);
    case 'run-failed':
      return lookup(FAILURES, detail);
    case 'check-skipped':
    case 'change-not-generated':
      return lookup(CHECK_SKIPS, detail);
    case 'unjudged':
      return lookup(UNJUDGED, detail);
    default:
      return detail;
  }
};

const oneLine = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();

  return flat.length > MAX_REASON
    ? `${flat.slice(0, MAX_REASON - 1).trimEnd()}…`
    : flat;
};

const sentenceOf = (reason: EntryReason): string => {
  const detail = detailOf(reason);
  const text = detail
    ? `${REASONS[reason.code]}: ${detail}`
    : REASONS[reason.code];

  return oneLine(/[.!?…]$/.test(text) ? text : `${text}.`);
};

const resultOf = (
  repeats: readonly ReplayEntry[],
  success: number | null,
  scoring: Scoring | null,
): TaskResult => {
  if (repeats.length === 0 || scoring === null) {
    return 'absent';
  }
  if (repeats.some((each) => !each.concludedFor(scoring))) {
    return 'pending';
  }
  if (success === null) {
    return 'unscored';
  }
  if (success === 1) {
    return 'succeeded';
  }

  return success === 0 ? 'failed' : 'mixed';
};

const SHOWN_REPEAT: Readonly<
  Record<TaskResult, (entry: ReplayEntry) => boolean>
> = {
  succeeded: (entry) => entry.succeeded === true,
  failed: (entry) => entry.succeeded === false,
  mixed: (entry) => entry.succeeded === false,
  unscored: (entry) => entry.succeeded === null,
  pending: (entry) => entry.reasons.length > 0,
  absent: () => false,
};

const sideOf = (
  repeats: readonly ReplayEntry[],
  success: number | null,
  scoring: Scoring | null,
): TaskSide => {
  const result = resultOf(repeats, success, scoring);
  const [reason] =
    result === 'pending'
      ? []
      : (repeats.find(SHOWN_REPEAT[result])?.reasons ?? []);

  return {
    result,
    successRate: success,
    reason: reason ? sentenceOf(reason) : FALLBACKS[result],
  };
};

const lost = (each: EntryComparison): boolean =>
  each.candidateSuccess !== null &&
  each.baselineSuccess !== null &&
  each.candidateSuccess < each.baselineSuccess;

const rankRows = (
  comparisons: readonly EntryComparison[],
): readonly EntryComparison[] =>
  [...comparisons].sort(
    (one, other) =>
      Number(other.regressed) - Number(one.regressed) ||
      Number(lost(other)) - Number(lost(one)) ||
      one.position - other.position,
  );

export const taskRowsOf = (
  comparisons: readonly EntryComparison[],
  scoring: { readonly candidate: Scoring; readonly live: Scoring | null },
  titles: ReadonlyMap<string, string | null>,
): readonly TaskRow[] =>
  rankRows(comparisons).map((each) => ({
    taskId: each.taskId,
    originalRunId: each.original,
    title: titles.get(each.original) ?? null,
    regressed: each.regressed,
    live: sideOf(each.baseline, each.baselineSuccess, scoring.live),
    candidate: sideOf(each.candidate, each.candidateSuccess, scoring.candidate),
  }));

import type {
  EntryChecksResponseDto,
  EntryComparisonResponseDto,
  EntryJudgeResponseDto,
  EntryReasonResponseDto,
  ReplayEntryResponseDto,
  ReplayResponseDto,
  ReplaySetEntryResponseDto,
} from '@/lib/api';

export type ReplayRefusal = NonNullable<ReplaySetEntryResponseDto['refusal']>;
export type ReplayState = ReplayResponseDto['state'];
export type EntryResult = ReplayEntryResponseDto['result'];
type ReasonCode = EntryReasonResponseDto['code'];
type ChecksState = EntryChecksResponseDto['state'];
type Unjudged = NonNullable<EntryJudgeResponseDto['unjudged']>;
export type ScoreUncompared = NonNullable<
  EntryComparisonResponseDto['scoreUncompared']
>;
type CheckSkip = NonNullable<EntryChecksResponseDto['why']>;

const REFUSALS: Record<ReplayRefusal, string> = {
  'unknown-run': 'There is no such run',
  'not-a-task-run': 'It worked no task of its own',
  'task-gone': 'Its task was deleted',
  'still-running': 'It has not ended yet',
  'no-starting-point': 'It never recorded where it started',
  'no-briefing': 'The task as it was briefed was never kept',
  'archive-gone': 'The workspace it started from is no longer kept',
  'attachments-gone': 'Files it was briefed with are gone',
  'repository-gone': 'A repository it worked in has left the line',
  'not-at-the-station': 'It did not run at this station',
  'candidate-unfit': 'The candidate cannot run it',
  'cannot-start': 'It could not be started',
  unchecked: 'It could not be checked just now',
  forgone: 'It was never started',
  'dispatch-failed': 'It failed to start after several tries',
};

const STATES: Record<ReplayState, string> = {
  queued: 'Queued',
  running: 'Running',
  finished: 'Finished',
  stopped: 'Stopped',
  'over-budget': 'Over budget',
};

const STATE_NOTES: Partial<Record<ReplayState, string>> = {
  queued: 'Waiting for a runner',
  stopped: 'Stopped by a person; nothing more starts',
  'over-budget': 'It spent its ceiling, so nothing more starts',
};

const RESULTS: Record<EntryResult, string> = {
  pending: 'Pending',
  succeeded: 'Succeeded',
  failed: 'Failed',
  unscored: 'Unscored',
};

const REASONS: Record<ReasonCode, string> = {
  unreplayable: 'It could not be replayed or started',
  'not-run': 'It never ran',
  'run-failed': 'The run failed',
  'run-stopped':
    'Its replay was stopped, or reached its ceiling, before the run finished',
  'asked-a-person': 'It asked a person, which a replay cannot',
  'check-failed': 'Its checks failed',
  'check-skipped': 'Its checks could not run',
  'change-undrafted': 'Its change could not be drafted',
  'no-change': 'It changed nothing for the checks to run on',
  'no-change-stack': 'It changed files, but its change never reached Spotlight',
  judged: 'The judge passed it',
  'judge-failed': 'The judge failed it',
  unjudged: 'The judge could not judge it',
  'nothing-judges': 'Neither checks nor a judge score this station',
};

const CHECKS: Record<ChecksState, string> = {
  absent: 'No change to check',
  drafting: 'Drafting its change',
  checking: 'Checking',
  passed: 'Checks passed',
  failed: 'Checks failed',
  none: 'Nothing checks it',
  unchecked: 'Unchecked',
};

const UNJUDGED: Record<Unjudged, string> = {
  unavailable: 'no judge model was available',
  'unreadable-rubric': 'the rubric could not be read',
  'no-evidence': 'there was nothing to judge',
  refused: 'the judge declined',
  unreadable: 'the judge’s answer could not be read',
  ungrounded: 'the judge cited nothing the run did',
  errored: 'judging went wrong',
  interrupted: 'judging was interrupted',
  'stopped-before-judging': 'the replay stopped before judging',
};

const UNCOMPARED: Record<ScoreUncompared, string> = {
  unjudged: 'One side was not judged',
  'other-rubric': 'Judged by different rubrics',
  'other-reference': 'Only one was judged against the accepted change',
};

const CHECK_SKIPS: Record<CheckSkip, string> = {
  'no-base': 'its starting commit was missing',
  'no-checkout': 'its checkout was missing',
  'checkout-failed': 'its checkout failed',
  'setup-failed': 'the repository’s setup failed',
  'no-room': 'there was no runner to check on',
  'out-of-time': 'the checks ran out of time',
  'no-image': 'the image to check in was missing',
  unprovisioned: 'no runner could be provisioned to check on',
  'nobody-checked': 'no runner took the check in time',
  skipped: 'the checks were skipped',
  undrafted: 'its change was never drafted',
  'no-check-asked': 'the candidate runs no check command',
};

type RunFailure = NonNullable<ReplayEntryResponseDto['failure']>;

const RUN_FAILURES: Record<RunFailure, string> = {
  exited: 'the agent exited with an error',
  unprepared:
    'its workspace could not be made ready before the agent began, so it goes unscored',
  refused:
    'Spotlight would not start it as configured, as for a harness profile that is missing or tools, MCP servers or secrets a replay is not given',
  unprovisioned: 'no runner could be provisioned, so it goes unscored',
  'hooks-unanswered': 'its hooks never answered, so it goes unscored',
  'runner-lost': 'the runner was lost, so it goes unscored',
  'timed-out': 'it kept running past its host’s time limit',
  superseded: 'it was superseded, so it goes unscored',
};

const RUN_STATES: Record<string, string> = {
  queued: 'Queued',
  claimed: 'Running',
  waiting: 'Waiting for a person',
  parked: 'Parked',
  completed: 'Completed',
  failed: 'Failed',
  superseded: 'Superseded',
};

const sentence = (words: string): string =>
  words.charAt(0).toUpperCase() + words.slice(1);

const isKey = <T extends string>(
  table: Record<T, string>,
  code: string,
): code is T => Object.hasOwn(table, code);

export const refusalShown = (refusal: ReplayRefusal): string =>
  REFUSALS[refusal];

export const replayableShown = (refusal: ReplayRefusal | null): string =>
  refusal ? refusalShown(refusal) : 'Can be replayed';

export const stateShown = (state: ReplayState): string => STATES[state];

export const stateNote = (state: ReplayState): string | null =>
  STATE_NOTES[state] ?? null;

export const resultShown = (result: EntryResult): string => RESULTS[result];

const skipShown = (code: string): string =>
  isKey(CHECK_SKIPS, code) ? CHECK_SKIPS[code] : code;

export const checksShown = (checks: EntryChecksResponseDto): string => {
  const said = CHECKS[checks.state];

  if (checks.state === 'failed' && checks.failedAt.length > 0) {
    return `${said} at ${checks.failedAt.join(', ')}`;
  }
  if (checks.state === 'unchecked' && checks.why) {
    return `${said}: ${skipShown(checks.why)}`;
  }

  return said;
};

export const uncomparedShown = (why: ScoreUncompared): string =>
  UNCOMPARED[why];

export const failureShown = (failure: string): string =>
  isKey(RUN_FAILURES, failure) ? RUN_FAILURES[failure] : failure;

export const runStateShown = (state: string): string =>
  RUN_STATES[state] ?? sentence(state);

const counted = (count: number, one: string, many: string): string =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

export const unpricedRunsShown = (count: number): string =>
  counted(count, 'run', 'runs');

export const unpricedCallsShown = (count: number): string =>
  counted(count, 'model call', 'model calls');

export const OVER_CEILING_NOTE =
  'Runs already running when the ceiling was reached finished, so a replay may end a little over it';

export const ELSEWHERE_NOTE =
  'Spent in another currency, so not counted against the ceiling';

const detailShown = (reason: EntryReasonResponseDto): string | null => {
  const detail = reason.detail;

  if (!detail) {
    return null;
  }

  switch (reason.code) {
    case 'unreplayable':
    case 'not-run':
      return isKey(REFUSALS, detail) ? REFUSALS[detail].toLowerCase() : detail;
    case 'run-failed':
      return failureShown(detail);
    case 'check-skipped':
    case 'change-undrafted':
      return skipShown(detail);
    case 'unjudged':
      return isKey(UNJUDGED, detail) ? UNJUDGED[detail] : detail;
    default:
      return detail;
  }
};

export const reasonShown = (reason: EntryReasonResponseDto): string => {
  const detail = detailShown(reason);

  return detail ? `${REASONS[reason.code]}: ${detail}` : REASONS[reason.code];
};

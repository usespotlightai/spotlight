import type {
  BalanceWarningResponseDto,
  EntryChecksResponseDto,
  EntryComparisonResponseDto,
  EntryJudgeResponseDto,
  EntryPairResponseDto,
  EntryReasonResponseDto,
  GainReadingResponseDto,
  PairTallyResponseDto,
  RateIntervalResponseDto,
  ReplayEntryResponseDto,
  ReplayResponseDto,
  ReplaySetEntryResponseDto,
  SetCompositionResponseDto,
  SetHealthResponseDto,
  SetNoiseResponseDto,
} from '@/lib/api';
import { formatPercent } from '@/lib/judge';
import { since } from '@/lib/since';

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
export type GainVerdictCode = GainReadingResponseDto['verdict'];
export type PairOutcome = NonNullable<EntryComparisonResponseDto['pair']>;
export type PairTally = PairTallyResponseDto;
type Unpaired = NonNullable<EntryPairResponseDto['unpaired']>;
export type TurnedOut = ReplaySetEntryResponseDto['outcome'];

const REFUSALS: Record<ReplayRefusal, string> = {
  'unknown-run': 'Run doesn’t exist',
  'not-a-task-run': 'Run has no task of its own',
  'task-gone': 'Task was deleted',
  'still-running': 'Run hasn’t ended yet',
  'no-starting-point': 'Run recorded no starting point',
  'no-briefing': 'Task briefing wasn’t kept',
  'archive-gone': 'Starting workspace is no longer kept',
  'attachments-gone': 'Briefing files are gone',
  'answer-gone': 'Its answer is gone',
  'repository-gone': 'Repository has left the line',
  'not-at-the-station': 'Run wasn’t at this station',
  'candidate-unfit': 'Candidate can’t run it',
  'cannot-start': 'Run couldn’t be started',
  unchecked: 'Couldn’t be checked just now',
  forgone: 'Never started',
  'dispatch-failed': 'Failed to start after several tries',
};

const STATES: Record<ReplayState, string> = {
  queued: 'Queued',
  running: 'Running',
  finished: 'Finished',
  stopped: 'Stopped',
  'over-budget': 'Over budget',
};

const STATE_NOTES: Partial<Record<ReplayState, string>> = {
  queued: 'The replay waits for a runner.',
  stopped: 'A person stopped the replay. No more runs start.',
  'over-budget': 'The replay reached its ceiling. No more runs start.',
};

const RESULTS: Record<EntryResult, string> = {
  pending: 'Pending',
  succeeded: 'Succeeded',
  failed: 'Failed',
  unscored: 'Unscored',
};

const REASONS: Record<ReasonCode, string> = {
  unreplayable: 'Couldn’t be replayed or started',
  'not-run': 'Never ran',
  'run-failed': 'Run failed',
  'run-stopped': 'Replay stopped or hit its ceiling before the run finished',
  'asked-a-person': 'Asked a person (replays can’t)',
  'check-failed': 'Checks failed',
  'check-skipped': 'Checks couldn’t run',
  'change-undrafted': 'Change couldn’t be drafted',
  'no-change': 'No change for the checks to run on',
  'no-change-stack': 'Files changed, but the change never reached Spotlight',
  judged: 'Judge passed it',
  'judge-failed': 'Judge failed it',
  unjudged: 'Judge couldn’t judge it',
  'nothing-judges': 'No checks or judge score this station',
};

const CHECKS: Record<ChecksState, string> = {
  absent: 'No change to check',
  drafting: 'Drafting the change',
  checking: 'Checking',
  passed: 'Checks passed',
  failed: 'Checks failed',
  none: 'No checks',
  unchecked: 'Unchecked',
};

const UNJUDGED: Record<Unjudged, string> = {
  unavailable: 'no judge model available',
  'unreadable-rubric': 'rubric couldn’t be read',
  'no-evidence': 'nothing to judge',
  refused: 'judge declined',
  unreadable: 'judge’s answer couldn’t be read',
  ungrounded: 'judge cited nothing the run did',
  errored: 'judging failed',
  interrupted: 'judging was interrupted',
  'stopped-before-judging': 'replay stopped before judging',
};

const UNCOMPARED: Record<ScoreUncompared, string> = {
  unjudged: 'One side wasn’t judged',
  'other-rubric': 'Judged by different rubrics',
  'other-reference': 'Only one judged against the accepted change',
};

const CHECK_SKIPS: Record<CheckSkip, string> = {
  'no-base': 'starting commit missing',
  'no-checkout': 'checkout missing',
  'checkout-failed': 'checkout failed',
  'setup-failed': 'repository setup failed',
  'no-room': 'no runner to check on',
  'out-of-time': 'checks ran out of time',
  'no-image': 'check image missing',
  unprovisioned: 'no runner could be provisioned for the check',
  'nobody-checked': 'no runner took the check in time',
  skipped: 'checks skipped',
  undrafted: 'change never drafted',
  'no-check-asked': 'candidate has no check command',
};

type RunFailure = NonNullable<ReplayEntryResponseDto['failure']>;

const RUN_FAILURES: Record<RunFailure, string> = {
  exited: 'agent exited with an error',
  unprepared: 'workspace setup failed before the agent started (not scored)',
  refused:
    'config not allowed: it has no harness profile, or it uses tools, MCP servers or secrets that replays don’t get',
  unprovisioned: 'no runner available (not scored)',
  'hooks-unanswered': 'hooks didn’t respond (not scored)',
  'runner-lost': 'runner lost (not scored)',
  'timed-out': 'exceeded the host’s time limit',
  superseded: 'superseded (not scored)',
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

export const formatRefusal = (refusal: ReplayRefusal): string =>
  REFUSALS[refusal];

export const formatReplayable = (refusal: ReplayRefusal | null): string =>
  refusal ? formatRefusal(refusal) : 'Can be replayed';

export const formatState = (state: ReplayState): string => STATES[state];

export const stateNote = (state: ReplayState): string | null =>
  STATE_NOTES[state] ?? null;

export const formatResult = (result: EntryResult): string => RESULTS[result];

const formatSkip = (code: string): string =>
  isKey(CHECK_SKIPS, code) ? CHECK_SKIPS[code] : code;

export const formatChecks = (checks: EntryChecksResponseDto): string => {
  const said = CHECKS[checks.state];

  if (checks.state === 'failed' && checks.failedAt.length > 0) {
    return `${said} at ${checks.failedAt.join(', ')}`;
  }
  if (checks.state === 'unchecked' && checks.why) {
    return `${said}: ${formatSkip(checks.why)}`;
  }

  return said;
};

export const formatUncompared = (why: ScoreUncompared): string =>
  UNCOMPARED[why];

export const formatFailure = (failure: string): string =>
  isKey(RUN_FAILURES, failure) ? RUN_FAILURES[failure] : failure;

export const failureSentence = (failure: string): string => {
  const shown = formatFailure(failure);
  return `${shown.charAt(0).toUpperCase()}${shown.slice(1)}.`;
};

export const formatRunState = (state: string): string =>
  RUN_STATES[state] ?? sentence(state);

const counted = (count: number, one: string, many: string): string =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

export const formatUnpricedRuns = (count: number): string =>
  counted(count, 'run', 'runs');

export const formatUnpricedCalls = (count: number): string =>
  counted(count, 'model call', 'model calls');

export const STATION_GONE_FROM_LINE = 'The station is gone from its line.';

export const RUNS_FROZEN_BY_SEARCH =
  'A search of this set is running. Add or take out runs after the search ends or a person stops it.';

const OVER_CEILING_NOTE =
  'Runs that are underway at the ceiling still finish. A replay can end slightly over its ceiling.';

const ELSEWHERE_NOTE =
  'These amounts are in another currency. They don’t count against the ceiling.';

const formatDetail = (reason: EntryReasonResponseDto): string | null => {
  const detail = reason.detail;

  if (!detail) {
    return null;
  }

  switch (reason.code) {
    case 'unreplayable':
    case 'not-run':
      return isKey(REFUSALS, detail) ? REFUSALS[detail].toLowerCase() : detail;
    case 'run-failed':
      return formatFailure(detail);
    case 'check-skipped':
    case 'change-undrafted':
      return formatSkip(detail);
    case 'unjudged':
      return isKey(UNJUDGED, detail) ? UNJUDGED[detail] : detail;
    default:
      return detail;
  }
};

export const formatReason = (reason: EntryReasonResponseDto): string => {
  const detail = formatDetail(reason);

  return detail ? `${REASONS[reason.code]}: ${detail}` : REASONS[reason.code];
};

const POINTS = 100;

const signedPoints = (share: number): string => {
  const points = Math.round(share * POINTS);

  return points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '0';
};

export const formatPoints = (share: number): string =>
  `${Math.round(share * POINTS)} pts`;

export const formatInterval = (
  interval: Pick<RateIntervalResponseDto, 'low' | 'high'>,
): string =>
  `${Math.round(interval.low * POINTS)}–${formatPercent(interval.high)}`;

export const INTERVAL_NOTE =
  'Likely range: the true rate falls inside it 95 times in 100.';

export const formatGain = (
  gain: Pick<GainReadingResponseDto, 'gain'>,
): string => `${signedPoints(gain.gain)} pts`;

export const formatGainRange = (
  gain: Pick<GainReadingResponseDto, 'low' | 'high'>,
): string => `${signedPoints(gain.low)} to ${signedPoints(gain.high)}`;

const GAIN_VERDICTS: Record<GainVerdictCode, string> = {
  better: 'Better',
  worse: 'Worse',
  'within-noise': 'within noise',
};

export const formatGainVerdict = (verdict: GainVerdictCode): string =>
  GAIN_VERDICTS[verdict];

export const formatMinGain = (minGain: number): string =>
  `+${formatPoints(minGain)}`;

export const gainVerdictNote = (gain: GainReadingResponseDto): string => {
  const minimum = `Minimum real gain: ${formatMinGain(gain.minGain)}`;
  const over = `on ${counted(gain.tasks, 'task', 'tasks')} with a score on both sides`;

  switch (gain.verdict) {
    case 'better':
      return `The gain ${over} is real. The likely range stays above zero and reaches the minimum. ${minimum}`;
    case 'worse':
      return `The loss ${over} is real. The likely range stays below zero and reaches the minimum. ${minimum}`;
    default:
      return `The difference ${over} can be chance. The likely range crosses zero or falls short of the minimum. ${minimum}`;
  }
};

export const formatCopiesSucceeded = (
  succeeded: number,
  scored: number,
): string =>
  scored === 0
    ? 'No copy scored yet'
    : `${succeeded} of ${scored} ${scored === 1 ? 'copy' : 'copies'} succeeded`;

export const formatCopy = (repeat: number): string => `Copy ${repeat}`;

export const formatRepeats = (repeats: number): string =>
  repeats === 1 ? 'Each run once' : `Each run ${repeats} times`;

export const REPEATS_HINT =
  'Spotlight replays each run this many times, from 1 to 5. More copies measure noise and narrow the ranges. They also add runs and spend.';

const NOISE_UNMEASURED = 'Not measured';

const formatNoise = (noise: SetNoiseResponseDto): string =>
  `Success moved ${formatPoints(noise.spread)} between ${noise.repeats} copies`;

export const formatPerRepeat = (perRepeat: readonly number[]): string =>
  perRepeat.map((rate) => formatPercent(rate)).join(', ');

export const formatFlipped = (count: number): string =>
  count === 0
    ? 'No task went both ways'
    : `${count} ${count === 1 ? 'task' : 'tasks'} went both ways`;

const NOISE_LABEL = 'Noise';

export const START_REPLAY = 'Start a replay';

export const formatEachCopy = (perRepeat: readonly number[]): string =>
  `Each copy: ${formatPerRepeat(perRepeat)}`;

export const MEASURED_ON_CONFIG = 'measured on config';

export const FLIPPED_TASKS_LABEL = 'Tasks that went both ways';

export const NOT_SCORED_YET = 'Not scored yet';

export const NO_SCORE_YET = 'No score yet';

export const SUCCEEDED = 'succeeded';

export const THE_BASELINE = 'the baseline';

export const VERSUS = 'vs';

export const formatRunsScored = (scored: number): string =>
  `of ${counted(scored, 'run', 'runs')} scored`;

export const formatHeldOutRuns = (runs: number): string =>
  `of ${counted(runs, 'held-out run', 'held-out runs')}`;

export const minGainSentence = (minGain: number): string =>
  `Minimum real gain: ${formatMinGain(minGain)}`;

const PROBE_REPEATS = 3;

const MIN_CHECKED_RUNS = 5;

const TWICE_CEILING =
  'Together, both replays can spend up to twice this ceiling.';

const formatTimes = (repeats: number): string =>
  repeats === 1 ? 'once' : `${repeats} times`;

const CHECKS_SET = `The first baseline checks the set. It replays each run ${PROBE_REPEATS} times with ${PROBE_REPEATS} times the ceiling. It judges and checks each change twice.`;

export const checksSetOf = (set: {
  readonly entries: readonly unknown[];
  readonly health: { readonly noise: unknown };
}): boolean => set.entries.length >= MIN_CHECKED_RUNS && !set.health.noise;

export const formatBaselineNote = (
  proposed: boolean,
  baselineRepeats: number | null,
  repeats: number | null,
  checks = false,
): string => {
  const checking = checks ? ` ${CHECKS_SET}` : '';

  if (baselineRepeats === null) {
    return proposed
      ? `The set has no baseline yet. A baseline of the live config also starts, with its own ceiling of the same size. ${TWICE_CEILING}${checking}`
      : `The set has no baseline yet. This replay of the live config becomes the baseline.${checking}`;
  }
  if (repeats !== null && repeats > baselineRepeats) {
    const fewer = `The set’s baseline replays each run ${formatTimes(baselineRepeats)}. This replay repeats each run more often.`;

    return proposed
      ? `${fewer} A new baseline that replays each run ${formatTimes(repeats)} also starts, with its own ceiling of the same size. ${TWICE_CEILING}${checking}`
      : `${fewer} This replay of the live config becomes the new baseline.${checking}`;
  }

  return proposed
    ? 'If the set’s runs changed since its baseline, a new baseline also starts. It gets its own ceiling of the same size.'
    : 'If the set’s runs changed since its baseline, this replay becomes the new baseline. Otherwise, Spotlight compares it with the current baseline.';
};

export type SetHealth = SetHealthResponseDto;
export type HealthKey = keyof SetHealth;
export type HealthTone = 'good' | 'bad' | 'pending' | 'unknown';

export type HealthReading = {
  readonly key: HealthKey;
  readonly label: string;
  readonly said: string;
  readonly tone: HealthTone;
  readonly advice: string;
};

const UNREAD_HEALTH: SetHealth = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  oracle: null,
};

export const HEALTH_LABEL = 'Health';

export const HEALTH_NOTE =
  'Shows whether this set can tell a better config from a worse one. The first baseline of the live config replays each run 3 times. Then Spotlight replays the live config with each run’s answer. Spotlight doesn’t check sets of fewer than 5 runs.';

const formatChanges = (count: number): string =>
  counted(count, 'change', 'changes');

const NOT_CHECKED = 'Not checked';

const stillToCome = (count: number, what: string): string =>
  count === 0 ? '' : ` ${count.toLocaleString()} ${what} are still to come.`;

const noiseReading = (
  noise: SetHealth['noise'],
  minGain: number,
): HealthReading => {
  const base = { key: 'noise', label: NOISE_LABEL } as const;

  if (!noise) {
    return {
      ...base,
      said: NOISE_UNMEASURED,
      tone: 'unknown',
      advice:
        'The first baseline of the live config replays each run 3 times to measure noise. Noise shows how much success moves by chance.',
    };
  }

  const minimum = `Minimum real gain: ${formatMinGain(minGain)}`;

  return {
    ...base,
    said: formatNoise(noise),
    tone: noise.noisyInOneCopy ? 'bad' : 'good',
    advice: noise.noisyInOneCopy
      ? `One copy can’t tell a real gain from chance. Search with more repeats per run, or raise the line’s min_gain. ${minimum}`
      : `Noise is within the line’s minimum real gain. A gain of that size is unlikely to be chance. ${minimum}`,
  };
};

const MEASURED_WITH_ANSWER =
  'If the set’s runs were accepted or sent back, Spotlight measures this with the answer after a replay of the whole set.';

const ANSWER_GIVEN =
  'Answer: the change people accepted, or what they said when they sent the run back.';

type OracleReading = NonNullable<SetHealth['oracle']>;

const LOST: readonly string[] = ['stopped', 'over-budget', 'gone'];

const oracleLost = (oracle: OracleReading): boolean =>
  oracle.state === 'stopped' ||
  oracle.state === 'over-budget' ||
  (oracle.againstState !== null && LOST.includes(oracle.againstState));

const liveRoomReading = (
  saturation: SetHealth['saturation'],
): Omit<HealthReading, 'key' | 'label'> => {
  if (!saturation) {
    return {
      said: NOISE_UNMEASURED,
      tone: 'unknown',
      advice:
        'Replay the live config over the whole set to see how much of it succeeds already.',
    };
  }

  const succeeds = `the live config succeeds on ${formatPercent(saturation.rate)}`;

  return saturation.saturated
    ? {
        said: `Almost none: ${succeeds}`,
        tone: 'bad',
        advice: `The set has no room for more success. Search for the same success at less cost, or add tasks that the live config fails. ${MEASURED_WITH_ANSWER}`,
      }
    : {
        said: sentence(succeeds),
        tone: 'good',
        advice: `The set has room for a search to find more success. ${MEASURED_WITH_ANSWER}`,
      };
};

const roomReading = (
  saturation: SetHealth['saturation'],
  oracle: SetHealth['oracle'],
): HealthReading => {
  const base = { key: 'saturation', label: 'Room to improve' } as const;

  if (!oracle) {
    return { ...base, ...liveRoomReading(saturation) };
  }
  if (oracle.state === 'queued' || oracle.state === 'running') {
    return {
      ...base,
      said: 'Measuring with the answer',
      tone: 'pending',
      advice: `Spotlight replays the live config with each run’s answer. ${ANSWER_GIVEN}`,
    };
  }
  if (oracleLost(oracle)) {
    return {
      ...base,
      said: 'Couldn’t measure with the answer',
      tone: 'unknown',
      advice: `The replay with the answer or its live replay didn’t finish. ${MEASURED_WITH_ANSWER}`,
    };
  }
  if (!oracle.gain || oracle.live === null || oracle.withAnswer === null) {
    return { ...base, ...liveRoomReading(saturation) };
  }

  if (oracle.roomToImprove === null) {
    return {
      ...base,
      said: `Too few runs to tell: ${counted(oracle.answered, 'run', 'runs')} with an answer`,
      tone: 'unknown',
      advice: `Spotlight needs 5 runs that were accepted or sent back to measure room. Please add some to the set. ${ANSWER_GIVEN}`,
    };
  }

  const rates = `Live config: ${formatPercent(oracle.live)} on ${counted(oracle.answered, 'run', 'runs')}. With the answer: ${formatPercent(oracle.withAnswer)}.`;

  return oracle.roomToImprove
    ? {
        ...base,
        said: `Up to ${formatGain(oracle.gain)} with the answer`,
        tone: 'good',
        advice: `${rates} A better config can gain up to this much. ${ANSWER_GIVEN}`,
      }
    : {
        ...base,
        said: `Little: ${formatGain(oracle.gain)} with the answer`,
        tone: 'bad',
        advice: `${rates} Even the answer barely helps. Add tasks that the live config fails, or search for the same success at less cost. ${ANSWER_GIVEN}`,
      };
};

export const healthReplayOf = (
  health: SetHealth,
  key: HealthKey,
): string | null =>
  key === 'saturation'
    ? (health.oracle?.replayId ?? health.saturation?.replayId ?? null)
    : (health[key]?.replayId ?? null);

const judgeReading = (judge: SetHealth['judge']): HealthReading => {
  const base = { key: 'judge', label: 'Judge agreeing with itself' } as const;

  if (!judge) {
    return {
      ...base,
      said: NOT_CHECKED,
      tone: 'unknown',
      advice:
        'The first baseline of the live config judges each change twice to measure this. It shows whether the verdicts match.',
    };
  }

  const pending = stillToCome(judge.pending, 'second judgings');

  if (judge.agreement === null) {
    return {
      ...base,
      said: 'Judging again',
      tone: 'pending',
      advice: `The judge is judging each change a second time.${pending}`,
    };
  }

  const said = `Same verdict on ${formatPercent(judge.agreement)} of ${formatChanges(judge.compared)}`;

  return judge.unstable
    ? {
        ...base,
        said,
        tone: 'bad',
        advice: `The verdicts are partly chance. Please make the rubric more specific before you search.${pending}`,
      }
    : {
        ...base,
        said,
        tone: 'good',
        advice: `The verdicts stay the same when the judge judges again.${pending}`,
      };
};

const checksReading = (checks: SetHealth['checks']): HealthReading => {
  const base = { key: 'checks', label: 'Flaky checks' } as const;

  if (!checks) {
    return {
      ...base,
      said: NOT_CHECKED,
      tone: 'unknown',
      advice:
        'The first baseline of the live config runs the station’s check twice on each change to measure this. It shows whether the check gives the same answer.',
    };
  }

  const pending = stillToCome(checks.pending, 'second checks');

  if (checks.rechecked === 0) {
    return {
      ...base,
      said: 'Checking again',
      tone: 'pending',
      advice: `Spotlight is checking each change a second time.${pending}`,
    };
  }

  return checks.flaky.length > 0
    ? {
        ...base,
        said: `${checks.flaky.length} of ${formatChanges(checks.rechecked)} flipped`,
        tone: 'bad',
        advice: `The check passed once and failed once on these changes. Please fix the flaky tests, or take these tasks out of the set.${pending}`,
      }
    : {
        ...base,
        said: `None of ${formatChanges(checks.rechecked)} flipped`,
        tone: 'good',
        advice: `The check gave the same answer both times.${pending}`,
      };
};

export const REPEATS_LABEL = 'Repeats';

export const formatHealthListLabel = (setName: string): string =>
  `${HEALTH_LABEL} of ${setName}`;

export const healthReadingsOf = (
  health: SetHealth,
  minGain: number,
): HealthReading[] => [
  noiseReading(health.noise, minGain),
  roomReading(health.saturation, health.oracle),
  judgeReading(health.judge),
  checksReading(health.checks),
];

export const HEALTH_LINE_LABELS: readonly string[] = healthReadingsOf(
  UNREAD_HEALTH,
  0,
).map((reading) => reading.label);

export const formatFlakyCheck = (
  flaky: Pick<
    NonNullable<SetHealth['checks']>['flaky'][number],
    'first' | 'recheck'
  >,
): string => `${sentence(flaky.first)}, then ${flaky.recheck}`;

export const FLAKY_TASKS_LABEL = 'Tasks whose check flipped';

export const AGAINST_LIVE = 'the live config';

export const HEALTH_REPLAY_LINK = 'View replay';

export const CLOSER_TO_ACCEPTED = 'Closer to the accepted change';

export const SIDE_BY_SIDE_WITH = 'Side by side with';

export const THE_SEARCH_START = 'the search’s starting config';

export const AN_EARLIER_BASELINE = 'an earlier baseline';

export const BASELINE_LABEL = 'Baseline';

export const LIVE_CONFIG_LABEL = 'Live config';

export const SEARCH_START_LABEL = 'Search’s starting config';

export const EARLIER_BASELINE_LABEL = 'Earlier baseline';

export const formatPairTally = (tally: PairTally): string =>
  [
    counted(tally.wins, 'win', 'wins'),
    counted(tally.losses, 'loss', 'losses'),
    counted(tally.ties, 'tie', 'ties'),
  ].join(', ');

export const pairTallyNote = (against: string): string =>
  `A blind judge compares each task’s change with ${against}’s change. It counts a win if this change is closer to the accepted change, and a loss if ${against}’s is closer. Otherwise, it counts a tie. Wins and losses don’t change the success rate.`;

export const pairsJudged = (tally: PairTally | null): tally is PairTally =>
  tally !== null && tally.wins + tally.losses + tally.ties > 0;

export const capitalised = (words: string): string =>
  `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

export const lowered = (words: string): string =>
  `${words.charAt(0).toLowerCase()}${words.slice(1)}`;

export const formatPair = (
  pair: PairOutcome | null,
  against: string,
): string => {
  switch (pair) {
    case 'win':
      return 'This one';
    case 'loss':
      return capitalised(against);
    case 'tie':
      return 'Neither';
    case null:
      return '–';
  }
};

export const OTHER_CHANGE = 'the other change';

export const OTHER_RUN = 'The other run';

export const READINGS_LABEL = 'Both readings';

export const PAIR_ASKED =
  'The judge hasn’t compared the changes side by side yet. It compares them when the replay finishes.';

export const PAIRING_SPEND_LABEL = 'Side by side';

const PAIRING_SPEND_NOTE =
  'Side-by-side judging counts against the ceiling. It doesn’t count toward cost per run.';

const UNPAIRED: Record<Unpaired, string> = {
  unavailable: 'no judge model available',
  'unreadable-rubric': 'rubric couldn’t be read',
  'no-evidence': 'nothing to compare',
  refused: 'judge declined',
  unreadable: 'judge’s answer couldn’t be read',
  ungrounded: 'judge cited nothing either change did',
  errored: 'judging failed',
  interrupted: 'judging was interrupted',
  'other-rubric': 'another judge version judged the counterpart',
  budget: 'no room left under the ceiling',
};

export const READINGS_DISAGREED =
  'The judge picked a different change depending on which change it saw first. This counts as a tie.';

export const formatUnpaired = (why: Unpaired | null): string =>
  `Not judged side by side: ${why ? UNPAIRED[why] : 'nothing to compare it with'}.`;

export const formatReading = (ownShownFirst: boolean): string =>
  ownShownFirst
    ? 'With this change shown first'
    : 'With the other change shown first';

export const formatCitedHunks = (
  own: number,
  theirs: number,
): string | null => {
  const parts = [
    ...(own > 0 ? [`${counted(own, 'hunk', 'hunks')} of this change`] : []),
    ...(theirs > 0 ? [`${counted(theirs, 'hunk', 'hunks')} of the other`] : []),
  ];

  return parts.length > 0 ? `Cites ${parts.join(' and ')}` : null;
};
const TURNED_OUT: Record<TurnedOut, string> = {
  accepted: 'Accepted',
  'sent-back': 'Sent back',
  asked: 'Asked a person',
  failed: 'Failed',
  other: 'Other',
};

const TURNED_OUT_PHRASES: Record<TurnedOut, string> = {
  accepted: 'were accepted',
  'sent-back': 'were sent back',
  asked: 'asked a person',
  failed: 'failed',
  other: 'turned out some other way',
};

export const formatTurnedOut = (outcome: TurnedOut): string =>
  TURNED_OUT[outcome];

const ORIGINS: Readonly<Record<string, string>> = {
  person: 'A person',
  station: 'Another station',
  unknown: 'Unknown',
  github: 'GitHub',
  slack: 'Slack',
  linear: 'Linear',
};

export const formatOrigin = (origin: string): string =>
  ORIGINS[origin] ?? `${origin.charAt(0).toUpperCase()}${origin.slice(1)}`;

export const TURNED_OUT_LABEL = 'How its runs turned out';

export const ORIGINS_LABEL = 'Where their tasks came from';

export const formatBalanceWarning = (
  warning: BalanceWarningResponseDto,
): string =>
  `${warning.count} of ${warning.entries} runs ${TURNED_OUT_PHRASES[warning.dominant]}. Add runs that turned out other ways to balance the set.`;

export const formatEndedSpan = (
  composition: SetCompositionResponseDto,
): string | null => {
  const { oldest, median, newest } = composition;

  if (!oldest || !median || !newest) {
    return null;
  }
  if (oldest === newest) {
    return `Ended ${since(oldest)}`;
  }

  return `Ended between ${since(oldest)} and ${since(newest)} · Median: ${since(median)}`;
};

export const SUGGESTIONS_LABEL = 'Suggested to even the mix';

export const SUGGESTIONS_NOTE =
  'Recent runs with outcomes that the set has few of. These runs join the set only when you add them.';

export const REGRESSED_NOTE = (against: string): string =>
  `Regressed: fewer copies succeeded than in ${against}, or the judge scored it lower.`;

export const BASELINE_NOTE =
  'The set’s baseline replays the live config. Most replays are compared with it. A search’s replays are compared with its starting config, and a replay with the answer with the live replay that started it.';

export const formatSuccessDetail = (
  totals: { readonly scored: number; readonly unscored: number },
  scoring: string,
): string =>
  [
    totals.unscored > 0
      ? `${totals.scored} scored, ${totals.unscored} not yet`
      : `${totals.scored} scored`,
    scoring,
  ].join(' · ');

export const formatPairTiles = (tally: PairTally) => ({
  value: counted(tally.wins, 'win', 'wins'),
  detail: `${counted(tally.losses, 'loss', 'losses')} · ${counted(tally.ties, 'tie', 'ties')}`,
});

export type SpendParts = {
  readonly runs: string;
  readonly drafting: string;
  readonly judging: string;
  readonly pairing: string | null;
  readonly elsewhere: readonly string[];
  readonly unpricedRuns: number;
  readonly unpricedCalls: number;
  readonly over: boolean;
};

export const formatSpendNote = (parts: SpendParts): string =>
  [
    `${[
      `Runs ${parts.runs}`,
      `Drafting ${parts.drafting}`,
      `Judging ${parts.judging}`,
      parts.pairing ? `${PAIRING_SPEND_LABEL} ${parts.pairing}` : null,
    ]
      .filter(Boolean)
      .join(' · ')}.`,
    parts.pairing ? PAIRING_SPEND_NOTE : null,
    parts.over ? OVER_CEILING_NOTE : null,
    parts.elsewhere.length > 0
      ? `Also spent ${parts.elsewhere.join(' · ')}. ${ELSEWHERE_NOTE}`
      : null,
    parts.unpricedRuns > 0 || parts.unpricedCalls > 0
      ? `Not priced: ${[
          parts.unpricedRuns > 0
            ? formatUnpricedRuns(parts.unpricedRuns)
            : null,
          parts.unpricedCalls > 0
            ? formatUnpricedCalls(parts.unpricedCalls)
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

export const formatTasksNote = (counterpart: string | null): string =>
  counterpart
    ? `Each task of the set, replayed and compared with ${counterpart}. Regressions come first. Pick a task to see its runs and judging.`
    : 'Each task of the set, replayed. Pick a task to see its runs and judging.';

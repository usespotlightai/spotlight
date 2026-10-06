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
import { percentShown } from '@/lib/judge';
import { since } from '@/lib/runner';

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
  queued: 'Waiting for a runner',
  stopped: 'Stopped by a person. No more runs start.',
  'over-budget': 'Ceiling reached. No more runs start.',
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
    'config not allowed: missing harness profile, or tools, MCP servers or secrets replays don’t get',
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

export const failureSentence = (failure: string): string => {
  const shown = failureShown(failure);
  return `${shown.charAt(0).toUpperCase()}${shown.slice(1)}.`;
};

export const runStateShown = (state: string): string =>
  RUN_STATES[state] ?? sentence(state);

const counted = (count: number, one: string, many: string): string =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

export const unpricedRunsShown = (count: number): string =>
  counted(count, 'run', 'runs');

export const unpricedCallsShown = (count: number): string =>
  counted(count, 'model call', 'model calls');

export const OVER_CEILING_NOTE =
  'Runs underway at the ceiling still finish. A replay may end slightly over it.';

export const ELSEWHERE_NOTE =
  'Spent in another currency. Not counted against the ceiling.';

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

const POINTS = 100;

const signedPoints = (share: number): string => {
  const points = Math.round(share * POINTS);

  return points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '0';
};

export const pointsShown = (share: number): string =>
  `${Math.round(share * POINTS)} pts`;

export const intervalShown = (
  interval: Pick<RateIntervalResponseDto, 'low' | 'high'>,
): string =>
  `${Math.round(interval.low * POINTS)}–${percentShown(interval.high)}`;

export const INTERVAL_NOTE =
  'Likely range: the true rate falls inside it 95 times in 100.';

export const gainShown = (gain: Pick<GainReadingResponseDto, 'gain'>): string =>
  `${signedPoints(gain.gain)} pts`;

export const gainRangeShown = (
  gain: Pick<GainReadingResponseDto, 'low' | 'high'>,
): string => `${signedPoints(gain.low)} to ${signedPoints(gain.high)}`;

const GAIN_VERDICTS: Record<GainVerdictCode, string> = {
  better: 'Better',
  worse: 'Worse',
  'within-noise': 'within noise',
};

export const gainVerdictShown = (verdict: GainVerdictCode): string =>
  GAIN_VERDICTS[verdict];

export const minGainShown = (minGain: number): string =>
  `+${pointsShown(minGain)}`;

export const gainVerdictNote = (gain: GainReadingResponseDto): string => {
  const minimum = `Minimum real gain: ${minGainShown(gain.minGain)}`;
  const over = `over ${counted(gain.tasks, 'task', 'tasks')} scored on both sides.`;

  switch (gain.verdict) {
    case 'better':
      return `Real gain ${over} Likely range stays above zero and reaches the minimum. ${minimum}`;
    case 'worse':
      return `Real loss ${over} Likely range stays below zero and reaches the minimum. ${minimum}`;
    default:
      return `Could be chance ${over} Likely range crosses zero or falls short of the minimum. ${minimum}`;
  }
};

export const copiesSucceededShown = (
  succeeded: number,
  scored: number,
): string =>
  scored === 0
    ? 'No copy scored yet'
    : `${succeeded} of ${scored} ${scored === 1 ? 'copy' : 'copies'} succeeded`;

export const copyShown = (repeat: number): string => `Copy ${repeat}`;

export const repeatsShown = (repeats: number): string =>
  repeats === 1 ? 'Each run once' : `Each run ${repeats} times`;

export const REPEATS_HINT =
  'Times each run is replayed, 1 to 5. More copies measure noise and narrow the ranges. Runs and spend grow with them.';

const NOISE_UNMEASURED = 'Not measured';

const noiseShown = (noise: SetNoiseResponseDto): string =>
  `Success moved ${pointsShown(noise.spread)} between ${noise.repeats} copies`;

export const perRepeatShown = (perRepeat: readonly number[]): string =>
  perRepeat.map((rate) => percentShown(rate)).join(', ');

export const flippedShown = (count: number): string =>
  count === 0
    ? 'No task went both ways'
    : `${count} ${count === 1 ? 'task' : 'tasks'} went both ways`;

const NOISE_LABEL = 'Noise';

export const START_REPLAY = 'Start a replay';

export const eachCopyShown = (perRepeat: readonly number[]): string =>
  `Each copy: ${perRepeatShown(perRepeat)}`;

export const MEASURED_ON_CONFIG = 'measured on config';

export const FLIPPED_TASKS_LABEL = 'Tasks that went both ways';

export const COPIES_LABEL = 'Copies';

export const NOT_SCORED_YET = 'Not scored yet';

export const NO_SCORE_YET = 'No score yet';

export const SUCCEEDED = 'succeeded';

export const THE_BASELINE = 'the baseline';

export const BASELINE = 'baseline';

export const VERSUS = 'vs';

export const runsScoredShown = (scored: number): string =>
  `of ${counted(scored, 'run', 'runs')} scored`;

export const heldOutRunsShown = (runs: number): string =>
  `of ${counted(runs, 'held-out run', 'held-out runs')}`;

export const minGainSentence = (minGain: number): string =>
  `Minimum real gain: ${minGainShown(minGain)}`;

const TWICE_CEILING = 'Most both may spend: twice this ceiling';

const timesShown = (repeats: number): string =>
  repeats === 1 ? 'once' : `${repeats} times`;

export const baselineNoteShown = (
  proposed: boolean,
  baselineRepeats: number | null,
  repeats: number | null,
): string => {
  if (baselineRepeats === null) {
    return proposed
      ? `Set has no baseline yet. A baseline of the live config also starts, with its own equal ceiling. ${TWICE_CEILING}`
      : 'Set has no baseline yet. This replay of the live config becomes it.';
  }
  if (repeats !== null && repeats > baselineRepeats) {
    const fewer = `Set’s baseline replays each run ${timesShown(baselineRepeats)}, fewer than this replay.`;

    return proposed
      ? `${fewer} A new baseline replaying each run ${timesShown(repeats)} also starts, with its own equal ceiling. ${TWICE_CEILING}`
      : `${fewer} This replay of the live config becomes the new baseline.`;
  }

  return proposed
    ? 'If the set’s runs changed since its baseline, a new baseline also starts. It gets its own equal ceiling.'
    : 'If the set’s runs changed since its baseline, this replay becomes the new baseline. Otherwise it replays beside it.';
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
  sanity: null,
};

export const HEALTH_LABEL = 'Health';

export const CHECK_SET = 'Check this set';

export const TRY_STRONGER_MODEL = 'Try a stronger model';

export const HEALTH_NOTE =
  'Whether this set can tell a better config from a worse one. Check it before you search on it.';

const changesShown = (count: number): string =>
  counted(count, 'change', 'changes');

const NOT_CHECKED = 'Not checked';

const stillToCome = (count: number, what: string): string =>
  count === 0 ? '' : ` ${count.toLocaleString()} ${what} still to come.`;

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
        'Check this set to replay the live config 3 times. Shows how much success moves by chance.',
    };
  }

  const noisy = noise.spread > minGain;
  const minimum = `Minimum real gain: ${minGainShown(minGain)}`;

  return {
    ...base,
    said: noiseShown(noise),
    tone: noisy ? 'bad' : 'good',
    advice: noisy
      ? `One copy can’t tell a real gain from chance. Search with more repeats per run, or raise the line’s min_gain. ${minimum}`
      : `Noise is within the line’s minimum real gain. A gain that size is unlikely to be chance. ${minimum}`,
  };
};

const saturationReading = (
  saturation: SetHealth['saturation'],
): HealthReading => {
  const base = { key: 'saturation', label: 'Room to improve' } as const;

  if (!saturation) {
    return {
      ...base,
      said: NOISE_UNMEASURED,
      tone: 'unknown',
      advice:
        'Replay the live config over the whole set to see how much of it succeeds already.',
    };
  }

  const succeeds = `the live config succeeds on ${percentShown(saturation.rate)}`;

  return saturation.saturated
    ? {
        ...base,
        said: `Almost none: ${succeeds}`,
        tone: 'bad',
        advice:
          'No room for more success. Search for the same success at less cost, or add tasks the live config fails.',
      }
    : {
        ...base,
        said: sentence(succeeds),
        tone: 'good',
        advice: 'Room left for a search to find more success.',
      };
};

const judgeReading = (judge: SetHealth['judge']): HealthReading => {
  const base = { key: 'judge', label: 'Judge agreeing with itself' } as const;

  if (!judge) {
    return {
      ...base,
      said: NOT_CHECKED,
      tone: 'unknown',
      advice:
        'Check this set to judge each change twice. Shows whether verdicts match.',
    };
  }

  const pending = stillToCome(judge.pending, 'second judgings');

  if (judge.agreement === null) {
    return {
      ...base,
      said: 'Judging again',
      tone: 'pending',
      advice: `Each change is being judged a second time.${pending}`,
    };
  }

  const said = `Same verdict on ${percentShown(judge.agreement)} of ${changesShown(judge.compared)}`;

  return judge.unstable
    ? {
        ...base,
        said,
        tone: 'bad',
        advice: `Verdicts are partly chance. Make the rubric more specific before you search.${pending}`,
      }
    : {
        ...base,
        said,
        tone: 'good',
        advice: `Verdicts hold when judged again.${pending}`,
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
        'Check this set to run the station’s check twice on each change. Shows whether it gives the same answer.',
    };
  }

  const pending = stillToCome(checks.pending, 'second checks');

  if (checks.rechecked === 0) {
    return {
      ...base,
      said: 'Checking again',
      tone: 'pending',
      advice: `Each change is being checked a second time.${pending}`,
    };
  }

  return checks.flaky.length > 0
    ? {
        ...base,
        said: `${checks.flaky.length} of ${changesShown(checks.rechecked)} flipped`,
        tone: 'bad',
        advice: `Check passed once and failed once on these. Fix the flaky tests, or take these tasks out of the set.${pending}`,
      }
    : {
        ...base,
        said: `None of ${changesShown(checks.rechecked)} flipped`,
        tone: 'good',
        advice: `Check gave the same answer both times.${pending}`,
      };
};

export const strongerConfigShown = (
  sanity: Pick<NonNullable<SetHealth['sanity']>, 'model' | 'effort'>,
): string =>
  [sanity.model, sanity.effort && `${sanity.effort} effort`]
    .filter(Boolean)
    .join(', ') || 'A stronger config';

type SanityReading = NonNullable<SetHealth['sanity']>;
type LostComparison = 'stopped' | 'over-budget' | 'gone';

const LOST_COMPARISONS: Record<LostComparison, string> = {
  stopped: 'was stopped',
  'over-budget': 'ran over its ceiling',
  gone: 'is gone',
};

const comparisonLost = (sanity: Pick<SanityReading, 'againstState'>): boolean =>
  sanity.againstState !== null &&
  Object.hasOwn(LOST_COMPARISONS, sanity.againstState);

export const sanityRetryable = (
  sanity: Pick<SanityReading, 'state' | 'againstState'>,
): boolean =>
  comparisonLost(sanity) ||
  sanity.state === 'stopped' ||
  sanity.state === 'over-budget';

export const TRY_AGAIN = 'Try again';

const liveEffortShown = (
  effort: string | null,
  lowest: string | null,
): string | null => {
  if (effort) {
    return effort;
  }

  return lowest ? `default (counted as ${lowest})` : null;
};

export const strongerHintShown = (
  effort: string | null,
  lowest: string | null,
  higher: readonly string[],
): string => {
  const live = liveEffortShown(effort, lowest);

  const labels = [
    live && `Live effort: ${live}`,
    `Higher efforts: ${higher.length > 0 ? higher.join(', ') : 'none'}`,
  ].filter(Boolean);

  return `Pick a model the harness offers, or a higher effort. ${labels.join(' · ')}`;
};

export const strongerTitleShown = (setName: string): string =>
  `Try a stronger model on ${setName}`;

export const probeTitleShown = (setName: string): string => `Check ${setName}`;

export const MODEL_AND_EFFORT_LABEL = 'Model and effort';

export const REPEATS_LABEL = 'Repeats';

export const START_STRONGER = 'Start replay';

export const START_PROBE = 'Start the check';

export const STARTING = 'Starting…';

export const LIVE_MODEL_UNREAD = 'The station’s model';

export const HARNESS_MODELS_UNREAD = 'The harness’s models and efforts';

export const healthListLabelShown = (setName: string): string =>
  `${HEALTH_LABEL} of ${setName}`;

export const EFFORT_NOT_HIGHER =
  'Effort isn’t higher than the live config’s. Pick a higher one, or keep the live effort.';

export const MODEL_NOT_OFFERED = 'Harness doesn’t offer that model.';

const sanityReading = (sanity: SetHealth['sanity']): HealthReading => {
  const base = { key: 'sanity', label: 'Stronger model' } as const;

  if (!sanity) {
    return {
      ...base,
      said: 'Not tried',
      tone: 'unknown',
      advice:
        'Replay the set with a stronger model or higher effort. A good set rewards it with more success.',
    };
  }

  const config = strongerConfigShown(sanity);

  if (sanity.state === 'queued' || sanity.state === 'running') {
    return {
      ...base,
      said: `Replaying with ${config}`,
      tone: 'pending',
      advice: 'Compared with the live config once its replay finishes.',
    };
  }
  if (sanity.state !== 'finished') {
    return {
      ...base,
      said: `${config} didn’t finish`,
      tone: 'unknown',
      advice:
        'Replay ended before every run finished. Try the stronger model again with a higher ceiling.',
    };
  }
  if (comparisonLost(sanity)) {
    return {
      ...base,
      said: 'Could not be compared',
      tone: 'unknown',
      advice: `Live replay to compare with ${LOST_COMPARISONS[sanity.againstState as LostComparison]}. Try the stronger model again.`,
    };
  }
  if (sanity.rewardsStrongerModel === null) {
    return {
      ...base,
      said: 'Nothing to compare with yet',
      tone: 'pending',
      advice:
        'Compared once a live-config replay with the same repeats finishes.',
    };
  }

  return sanity.rewardsStrongerModel
    ? {
        ...base,
        said: `${config} did better`,
        tone: 'good',
        advice: 'Set rewards a stronger config. It can tell better work apart.',
      }
    : {
        ...base,
        said: `${config} didn’t do clearly better`,
        tone: 'bad',
        advice:
          'Set’s tasks may be unclear, or its scoring off. Review the rubric and checks of tasks it did worse on.',
      };
};

export const healthReadingsOf = (
  health: SetHealth,
  minGain: number,
): HealthReading[] => [
  noiseReading(health.noise, minGain),
  saturationReading(health.saturation),
  judgeReading(health.judge),
  checksReading(health.checks),
  sanityReading(health.sanity),
];

export const HEALTH_LINE_LABELS: readonly string[] = healthReadingsOf(
  UNREAD_HEALTH,
  0,
).map((reading) => reading.label);

export const flakyCheckShown = (
  flaky: Pick<
    NonNullable<SetHealth['checks']>['flaky'][number],
    'first' | 'recheck'
  >,
): string => `${sentence(flaky.first)}, then ${flaky.recheck}`;

export const worseTaskShown = (
  worse: Pick<
    NonNullable<SetHealth['sanity']>['worse'][number],
    'live' | 'stronger'
  >,
): string =>
  `${percentShown(worse.live)} live, ${percentShown(worse.stronger)} stronger`;

export const FLAKY_TASKS_LABEL = 'Tasks whose check flipped';

export const WORSE_TASKS_LABEL = 'Tasks the stronger model did worse on';

export const AGAINST_LIVE = 'the live config';

export const HEALTH_REPLAY_LINK = 'View replay';

export const PROBE_NOTE =
  'Replays the live config over the set 3 times to measure noise. Then re-judges and re-checks each change for consistency.';

export const PROBE_CEILING_NOTE =
  'Most the check may spend: its runs, plus judging and checking each change twice. Nothing more starts once spent.';

export const STRONGER_MODEL_NOTE =
  'Replays the set with a stronger model or higher effort. A good set rewards it with clearly more success.';

export const STRONGER_CEILING_NOTE =
  'Most this replay may spend. A live-config replay with the same repeats also starts if none exists. It gets its own equal ceiling.';

export const SAME_AS_LIVE =
  'Choose a model or effort other than the live config’s.';

export const NO_HARNESS = 'Station names no harness. No model to choose.';

export const CLOSER_TO_ACCEPTED = 'Closer to the accepted change';

export const SIDE_BY_SIDE_WITH = 'Side by side with';

export const THE_SEARCH_START = 'the search’s starting config';

export const AN_EARLIER_BASELINE = 'an earlier baseline';

export const versusShown = (measure: string, against: string): string =>
  `${measure} vs ${against}`;

export const pairTallyShown = (tally: PairTally): string =>
  [
    counted(tally.wins, 'win', 'wins'),
    counted(tally.losses, 'loss', 'losses'),
    counted(tally.ties, 'tie', 'ties'),
  ].join(', ');

export const pairTallyNote = (against: string): string =>
  `A blind judge compares each task’s change with ${against}’s. Win: this one is closer to the accepted change. Loss: ${against}’s is closer. Tie: neither. Success rate is unaffected.`;

export const pairsJudged = (tally: PairTally | null): tally is PairTally =>
  tally !== null && tally.wins + tally.losses + tally.ties > 0;

export const capitalised = (words: string): string =>
  `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

export const pairShown = (
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
  'Not judged side by side yet. Happens once the replay finishes.';

export const PAIRING_SPEND_LABEL = 'Side by side';

export const PAIRING_SPEND_NOTE =
  'Side-by-side judging counts against the ceiling. It doesn’t count toward cost per run.';

export const COMPARED_WITH = 'Each task compared with';

const UNPAIRED: Record<Unpaired, string> = {
  unavailable: 'no judge model available',
  'unreadable-rubric': 'rubric couldn’t be read',
  'no-evidence': 'nothing to compare',
  refused: 'judge declined',
  unreadable: 'judge’s answer couldn’t be read',
  ungrounded: 'judge cited nothing either change did',
  errored: 'judging failed',
  interrupted: 'judging was interrupted',
  'other-rubric': 'counterpart was judged by another judge version',
  budget: 'no room left under the ceiling',
};

export const READINGS_DISAGREED =
  'Judge picked a different change depending on which it saw first. Counts as a tie.';

export const unpairedShown = (why: Unpaired | null): string =>
  `Not judged side by side: ${why ? UNPAIRED[why] : 'nothing to compare it with'}.`;

export const readingShown = (ownShownFirst: boolean): string =>
  ownShownFirst
    ? 'With this change shown first'
    : 'With the other change shown first';

export const citedHunksShown = (own: number, theirs: number): string | null => {
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

export const turnedOutShown = (outcome: TurnedOut): string =>
  TURNED_OUT[outcome];

const ORIGINS: Readonly<Record<string, string>> = {
  person: 'A person',
  station: 'Another station',
  unknown: 'Unknown',
  github: 'GitHub',
  slack: 'Slack',
  linear: 'Linear',
};

export const originShown = (origin: string): string =>
  ORIGINS[origin] ?? `${origin.charAt(0).toUpperCase()}${origin.slice(1)}`;

export const COMPOSITION_LABEL = 'What the set is made of';

export const TURNED_OUT_LABEL = 'How its runs turned out';

export const ORIGINS_LABEL = 'Where their tasks came from';

export const balanceWarningShown = (
  warning: BalanceWarningResponseDto,
): string =>
  `${warning.count} of ${warning.entries} runs ${TURNED_OUT_PHRASES[warning.dominant]}. Add runs that turned out other ways to balance the set.`;

export const endedSpanShown = (
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
  'Recent runs with outcomes the set has few of. Nothing is added until you add it.';

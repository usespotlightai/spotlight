import type {
  EntryChecksResponseDto,
  EntryComparisonResponseDto,
  EntryJudgeResponseDto,
  EntryReasonResponseDto,
  GainReadingResponseDto,
  RateIntervalResponseDto,
  ReplayEntryResponseDto,
  ReplayResponseDto,
  ReplaySetEntryResponseDto,
  SetHealthResponseDto,
  SetNoiseResponseDto,
} from '@/lib/api';
import { percentShown } from '@/lib/judge';

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
  'The likely range: 95 times in 100, the true rate falls within it';

export const gainShown = (gain: Pick<GainReadingResponseDto, 'gain'>): string =>
  `${signedPoints(gain.gain)} pts`;

export const gainRangeShown = (
  gain: Pick<GainReadingResponseDto, 'low' | 'high'>,
): string => `${signedPoints(gain.low)} to ${signedPoints(gain.high)}`;

const GAIN_VERDICTS: Record<GainVerdictCode, string> = {
  better: 'Better',
  worse: 'Worse',
  'within-noise': 'Within noise',
};

export const gainVerdictShown = (verdict: GainVerdictCode): string =>
  GAIN_VERDICTS[verdict];

export const minGainShown = (minGain: number): string =>
  `+${pointsShown(minGain)}`;

export const gainVerdictNote = (gain: GainReadingResponseDto): string => {
  const real = minGainShown(gain.minGain);
  const over = `over ${gain.tasks.toLocaleString()} ${gain.tasks === 1 ? 'task' : 'tasks'} both scored`;

  switch (gain.verdict) {
    case 'better':
      return `A real gain ${over}: its likely range stays above no change, and it reaches the ${real} the line counts as real.`;
    case 'worse':
      return `A real loss ${over}: its likely range stays below no change, and it reaches the ${real} the line counts as real.`;
    default:
      return `Could be chance ${over}: its likely range reaches across no change, or it is short of the ${real} the line counts as real.`;
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
  'How many times each run is replayed, 1 to 5. More copies measure the set’s noise and narrow the ranges; runs and spend grow with them.';

const NOISE_UNMEASURED = 'Not measured';

const noiseShown = (noise: SetNoiseResponseDto): string =>
  `Success moved ${pointsShown(noise.spread)} between ${noise.repeats} copies`;

const noiseAgainstShown = (
  noise: SetNoiseResponseDto,
  minGain: number,
): string =>
  noise.spread > minGain
    ? `more than the ${minGainShown(minGain)} the line counts as real, so one copy can’t tell a real gain from chance`
    : `within the ${minGainShown(minGain)} the line counts as real`;

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
  `a gain in success counts as real from ${minGainShown(minGain)}`;

const timesShown = (repeats: number): string =>
  repeats === 1 ? 'once' : `${repeats} times`;

export const baselineNoteShown = (
  proposed: boolean,
  baselineRepeats: number | null,
  repeats: number | null,
): string => {
  if (baselineRepeats === null) {
    return proposed
      ? 'The set has no baseline yet, so a baseline of the live config also starts beside it, with a ceiling of its own the same as this one: the two together may spend up to twice it.'
      : 'The set has no baseline yet, so this replay of the live config becomes it.';
  }
  if (repeats !== null && repeats > baselineRepeats) {
    const fewer = `The set’s baseline replays each run ${timesShown(baselineRepeats)}, fewer than this replay`;

    return proposed
      ? `${fewer}, so a new baseline of the live config also starts beside it, replaying each run ${timesShown(repeats)}, with a ceiling of its own the same as this one: the two together may spend up to twice it.`
      : `${fewer}, so this replay of the live config becomes the new baseline.`;
  }

  return proposed
    ? 'If the set’s runs changed since its baseline, a new baseline of the live config also starts, with a ceiling of its own the same as this one.'
    : 'If the set’s runs changed since its baseline, this replay of the live config becomes the new baseline; otherwise it replays beside it.';
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
        'Check this set to replay the live config over it 3 times and see how much its success moves by chance alone.',
    };
  }

  const noisy = noise.spread > minGain;

  return {
    ...base,
    said: noiseShown(noise),
    tone: noisy ? 'bad' : 'good',
    advice: noisy
      ? `${sentence(noiseAgainstShown(noise, minGain))}. Search with each run replayed more times, or raise the line’s min_gain.`
      : `${sentence(noiseAgainstShown(noise, minGain))}, so a gain that size is unlikely to be chance.`,
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
          'A search for more success has nowhere to go. Search for the same success at less cost, or add tasks the live config fails.',
      }
    : {
        ...base,
        said: sentence(succeeds),
        tone: 'good',
        advice: 'There is room for a search to find more success.',
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
        'Check this set to judge each change a second time and see whether the judge gives the same verdict.',
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
        advice: `Its verdicts are partly chance, so a search would chase luck. Make the rubric more specific before you search.${pending}`,
      }
    : {
        ...base,
        said,
        tone: 'good',
        advice: `Its verdicts hold when it is asked again.${pending}`,
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
        'Check this set to run the station’s check a second time on each change and see whether it gives the same answer.',
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
        advice: `The check passed once and failed once on these, so it can flip a candidate’s result by chance. Fix the flaky tests, or take these tasks out of the set.${pending}`,
      }
    : {
        ...base,
        said: `None of ${changesShown(checks.rechecked)} flipped`,
        tone: 'good',
        advice: `The check gave the same answer both times.${pending}`,
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
): string => {
  if (effort) {
    return ` ${effort}`;
  }

  return lowest ? ` default, counted as its lowest, ${lowest}` : '';
};

export const strongerHintShown = (
  effort: string | null,
  lowest: string | null,
  higher: readonly string[],
): string =>
  `Pick a model the harness offers, or a higher effort than the live config’s${liveEffortShown(effort, lowest)}${higher.length > 0 ? `: ${higher.join(', ')}` : ', which it has none of'}.`;

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

export const compactHealthLabelShown = (label: string): string => `${label}:`;

export const healthListLabelShown = (setName: string): string =>
  `${HEALTH_LABEL} of ${setName}`;

export const EFFORT_NOT_HIGHER =
  'That effort is not higher than the live config’s. Pick a higher one, or keep the live effort.';

export const MODEL_NOT_OFFERED = 'Its harness does not offer that model.';

const sanityReading = (sanity: SetHealth['sanity']): HealthReading => {
  const base = { key: 'sanity', label: 'Stronger model' } as const;

  if (!sanity) {
    return {
      ...base,
      said: 'Not tried',
      tone: 'unknown',
      advice:
        'Replay the set with a stronger model or a higher effort. A good set rewards it; if it doesn’t, its tasks may be unclear or its scoring off.',
    };
  }

  const config = strongerConfigShown(sanity);

  if (sanity.state === 'queued' || sanity.state === 'running') {
    return {
      ...base,
      said: `Replaying with ${config}`,
      tone: 'pending',
      advice: 'It is compared with the live config once its replay finishes.',
    };
  }
  if (sanity.state !== 'finished') {
    return {
      ...base,
      said: `${config} did not finish`,
      tone: 'unknown',
      advice:
        'Its replay ended before every run did, so nothing was compared. Try the stronger model again with a higher ceiling.',
    };
  }
  if (comparisonLost(sanity)) {
    return {
      ...base,
      said: 'Could not be compared',
      tone: 'unknown',
      advice: `The live replay it was compared with ${LOST_COMPARISONS[sanity.againstState as LostComparison]}, so this can’t be compared. Try the stronger model again.`,
    };
  }
  if (sanity.rewardsStrongerModel === null) {
    return {
      ...base,
      said: 'Nothing to compare with yet',
      tone: 'pending',
      advice:
        'It is compared once a replay of the live config, run as often, finishes on the set.',
    };
  }

  return sanity.rewardsStrongerModel
    ? {
        ...base,
        said: `${config} did better`,
        tone: 'good',
        advice:
          'The set rewards a stronger config, so it can tell better work apart.',
      }
    : {
        ...base,
        said: `${config} did not do clearly better`,
        tone: 'bad',
        advice:
          'A stronger config should do better, so the set’s tasks may be unclear or its scoring off. Start with the tasks it did worse on: their rubric or checks may be wrong.',
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

export const HEALTH_REPLAY_LINK = 'Its replay';

export const PROBE_NOTE =
  'Replays the live config over the set 3 times, which measures its noise. Then the judge judges each change again and the check runs again on each, to see whether they give the same answer.';

export const PROBE_CEILING_NOTE =
  'The most the check may spend: its runs, and judging and checking each change twice. Once it is spent, nothing more starts.';

export const STRONGER_MODEL_NOTE =
  'Replays the set under the live config with a stronger model or a higher effort. A good set rewards it with clearly more success.';

export const STRONGER_CEILING_NOTE =
  'The most this replay may spend. If the set has no replay of the live config run as often, one also starts beside it to compare with, with a ceiling of its own the same as this one.';

export const SAME_AS_LIVE =
  'Choose a model or an effort other than the live config’s.';

export const NO_HARNESS =
  'The station names no harness, so there is no model to choose.';

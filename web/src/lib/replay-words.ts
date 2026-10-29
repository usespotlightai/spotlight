import type {
  GainEstimateResponseDto,
  ReplayedCandidateResponseDto,
  ReplaySetHealthResponseDto,
  SetNoiseResponseDto,
} from '@/lib/api';
import { formatPercent } from '@/lib/judge';

export type ReplayState = NonNullable<
  ReplayedCandidateResponseDto['replayState']
>;
export type GainSignificanceCode = GainEstimateResponseDto['significance'];

const STATES: Record<ReplayState, string> = {
  queued: 'Queued',
  running: 'Running',
  finished: 'Finished',
  stopped: 'Stopped',
  'ceiling-reached': 'Ceiling reached',
};

const STATE_NOTES: Partial<Record<ReplayState, string>> = {
  queued: 'The replay waits for a runner.',
  stopped: 'Spotlight stopped the replay. No more runs start.',
  'ceiling-reached': 'The replay reached its ceiling. No more runs start.',
};

const sentence = (words: string): string =>
  words.charAt(0).toUpperCase() + words.slice(1);

export const formatState = (state: ReplayState): string => STATES[state];

export const stateNote = (state: ReplayState): string | null =>
  STATE_NOTES[state] ?? null;

const counted = (count: number, one: string, many: string): string =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

export const REPLAY_SET_TITLE = 'Replay set';

const POINTS = 100;

const signedPoints = (share: number): string => {
  const points = Math.round(share * POINTS);

  return points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '0';
};

export const formatPoints = (share: number): string =>
  `${Math.round(share * POINTS)} pts`;

export const formatGain = (
  gain: Pick<GainEstimateResponseDto, 'gain'>,
): string => `${signedPoints(gain.gain)} pts`;

const GAIN_SIGNIFICANCES: Record<GainSignificanceCode, string> = {
  better: 'Better',
  worse: 'Worse',
  'within-noise': 'within noise',
};

export const formatGainSignificance = (
  significance: GainSignificanceCode,
): string => GAIN_SIGNIFICANCES[significance];

const formatMinGain = (minGain: number): string => `+${formatPoints(minGain)}`;

export const gainSignificanceNote = (gain: GainEstimateResponseDto): string => {
  const minimum = `Minimum real gain: ${formatMinGain(gain.minGain)}`;
  const over = `on ${counted(gain.tasks, 'task', 'tasks')} with a score on both sides`;

  switch (gain.significance) {
    case 'better':
      return `The gain ${over} is real. The likely range stays above zero and reaches the minimum. ${minimum}`;
    case 'worse':
      return `The loss ${over} is real. The likely range stays below zero and reaches the minimum. ${minimum}`;
    default:
      return `The difference ${over} can be chance. The likely range crosses zero or falls short of the minimum. ${minimum}`;
  }
};

const NOISE_UNMEASURED = 'Not measured';

const formatNoise = (noise: SetNoiseResponseDto): string =>
  `Success moved ${formatPoints(noise.spread)} between ${noise.repeats} repeats`;

const NOISE_LABEL = 'Noise';

export const formatHeldOutRuns = (runs: number): string =>
  `of ${counted(runs, 'held-out run', 'held-out runs')}`;

export type SetHealth = Pick<
  ReplaySetHealthResponseDto,
  'noise' | 'saturation' | 'judge' | 'checks' | 'oracle'
>;
type HealthKey = keyof SetHealth;
type HealthTone = 'good' | 'bad' | 'pending' | 'unknown';

export type HealthReading = {
  readonly key: HealthKey;
  readonly label: string;
  readonly text: string;
  readonly tone: HealthTone;
  readonly advice: string;
};

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
      text: NOISE_UNMEASURED,
      tone: 'unknown',
      advice:
        'The first baseline of the live config replays each run 3 times to measure noise. Noise shows how much success moves by chance.',
    };
  }

  const minimum = `Minimum real gain: ${formatMinGain(minGain)}`;

  return {
    ...base,
    text: formatNoise(noise),
    tone: noise.noisyInOneRepeat ? 'bad' : 'good',
    advice: noise.noisyInOneRepeat
      ? `One repeat can’t tell a real gain from chance. Search with more repeats per run, or raise the line’s min_gain. ${minimum}`
      : `Noise is within the line’s minimum real gain. A gain of that size is unlikely to be chance. ${minimum}`,
  };
};

const MEASURED_WITH_ANSWER =
  'If the set’s runs were accepted or sent back, Spotlight measures this with the answer after a replay of the whole set.';

const ANSWER_DEFINITION =
  'Answer: the change people accepted, or what they said when they sent the run back.';

type OracleReading = NonNullable<SetHealth['oracle']>;

const LOST: readonly string[] = ['stopped', 'ceiling-reached', 'gone'];

const oracleLost = (oracle: OracleReading): boolean =>
  oracle.state === 'stopped' ||
  oracle.state === 'ceiling-reached' ||
  (oracle.referenceState !== null && LOST.includes(oracle.referenceState));

const liveRoomReading = (
  saturation: SetHealth['saturation'],
): Omit<HealthReading, 'key' | 'label'> => {
  if (!saturation) {
    return {
      text: NOISE_UNMEASURED,
      tone: 'unknown',
      advice:
        'Spotlight replays the live config over the whole set to see how much of it succeeds already.',
    };
  }

  const succeeds = `the live config succeeds on ${formatPercent(saturation.rate)}`;

  return saturation.saturated
    ? {
        text: `Almost none: ${succeeds}`,
        tone: 'bad',
        advice: `The set has no room for more success. Search for the same success at less cost, or add tasks that the live config fails. ${MEASURED_WITH_ANSWER}`,
      }
    : {
        text: sentence(succeeds),
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
      text: 'Measuring with the answer',
      tone: 'pending',
      advice: `Spotlight replays the live config with each run’s answer. ${ANSWER_DEFINITION}`,
    };
  }
  if (oracleLost(oracle)) {
    return {
      ...base,
      text: 'Couldn’t measure with the answer',
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
      text: `Too few runs to tell: ${counted(oracle.answered, 'run', 'runs')} with an answer`,
      tone: 'unknown',
      advice: `Spotlight needs 5 runs that were accepted or sent back to measure room. Spotlight adds runs to the set as the station works more tasks. ${ANSWER_DEFINITION}`,
    };
  }

  const rates = `Live config: ${formatPercent(oracle.live)} on ${counted(oracle.answered, 'run', 'runs')}. With the answer: ${formatPercent(oracle.withAnswer)}.`;

  return oracle.roomToImprove
    ? {
        ...base,
        text: `Up to ${formatGain(oracle.gain)} with the answer`,
        tone: 'good',
        advice: `${rates} A better config can gain up to this much. ${ANSWER_DEFINITION}`,
      }
    : {
        ...base,
        text: `Little: ${formatGain(oracle.gain)} with the answer`,
        tone: 'bad',
        advice: `${rates} Even the answer barely helps. Add tasks that the live config fails, or search for the same success at less cost. ${ANSWER_DEFINITION}`,
      };
};

const judgeReading = (judge: SetHealth['judge']): HealthReading => {
  const base = { key: 'judge', label: 'Judge agreeing with itself' } as const;

  if (!judge) {
    return {
      ...base,
      text: NOT_CHECKED,
      tone: 'unknown',
      advice:
        'The first baseline of the live config judges each change twice to measure this. It shows whether the verdicts match.',
    };
  }

  const pending = stillToCome(judge.pending, 'second judgings');

  if (judge.agreement === null) {
    return {
      ...base,
      text: 'Judging again',
      tone: 'pending',
      advice: `The judge is judging each change a second time.${pending}`,
    };
  }

  const text = `Same verdict on ${formatPercent(judge.agreement)} of ${formatChanges(judge.compared)}`;

  return judge.unstable
    ? {
        ...base,
        text,
        tone: 'bad',
        advice: `The verdicts are partly chance. Please make the rubric more specific before you search.${pending}`,
      }
    : {
        ...base,
        text,
        tone: 'good',
        advice: `The verdicts stay the same when the judge judges again.${pending}`,
      };
};

const checksReading = (checks: SetHealth['checks']): HealthReading => {
  const base = { key: 'checks', label: 'Flaky checks' } as const;

  if (!checks) {
    return {
      ...base,
      text: NOT_CHECKED,
      tone: 'unknown',
      advice:
        'The first baseline of the live config runs the station’s check twice on each change to measure this. It shows whether the check returns the same answer.',
    };
  }

  const pending = stillToCome(checks.pending, 'second checks');

  if (checks.rechecked === 0) {
    return {
      ...base,
      text: 'Checking again',
      tone: 'pending',
      advice: `Spotlight is checking each change a second time.${pending}`,
    };
  }

  return checks.flaky.length > 0
    ? {
        ...base,
        text: `${checks.flaky.length} of ${formatChanges(checks.rechecked)} flipped`,
        tone: 'bad',
        advice: `The check passed once and failed once on these changes. Please fix the flaky tests.${pending}`,
      }
    : {
        ...base,
        text: `None of ${formatChanges(checks.rechecked)} flipped`,
        tone: 'good',
        advice: `The check gave the same answer both times.${pending}`,
      };
};

export const healthReadingsOf = (
  health: SetHealth,
  minGain: number,
): HealthReading[] => [
  noiseReading(health.noise, minGain),
  roomReading(health.saturation, health.oracle),
  judgeReading(health.judge),
  checksReading(health.checks),
];

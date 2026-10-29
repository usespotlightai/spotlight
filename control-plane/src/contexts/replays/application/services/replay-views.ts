import type {
  GainEstimateDto,
  MoneyDto,
  RateIntervalDto,
  SetHealthDto,
  SetNoiseDto,
} from '@replays/application/dto/replays.dto';
import type { RateInterval } from '@replays/domain/services/bootstrap';
import { type GainEstimate } from '@replays/domain/services/gain-estimate';
import type { SetHealth } from '@replays/domain/services/set-health';
import type { SetNoiseReading } from '@replays/domain/services/set-noise';
import type { Money } from '@replays/domain/value-objects/money.vo';

export const moneyView = (money: Money): MoneyDto => ({
  amount: money.amount,
  currency: money.currency,
});

export const intervalView = (
  interval: RateInterval | null,
): RateIntervalDto | null =>
  interval && { rate: interval.rate, low: interval.low, high: interval.high };

export const gainView = (gain: GainEstimate | null): GainEstimateDto | null =>
  gain && {
    gain: gain.gain,
    low: gain.low,
    high: gain.high,
    significance: gain.significance,
    minGain: gain.minGain,
    tasks: gain.tasks,
  };

const noiseView = (noise: SetNoiseReading | null): SetNoiseDto | null =>
  noise && {
    replayId: noise.replayId.value,
    fingerprint: noise.fingerprint.value,
    repeats: noise.repeats,
    perRepeat: [...noise.perRepeat],
    spread: noise.spread,
    flippedTasks: [...noise.flippedTasks],
    measuredAt: noise.measuredAt.toISOString(),
    noisyInOneRepeat: noise.noisyInOneRepeat,
  };

export const healthView = (health: SetHealth): SetHealthDto => {
  const { saturation, judge, checks, oracle } = health;

  return {
    noise: noiseView(health.noise),
    saturation: saturation && {
      replayId: saturation.replayId.value,
      rate: saturation.rate,
      interval: intervalView(saturation.interval),
      saturated: saturation.saturated,
      measuredAt: saturation.measuredAt.toISOString(),
    },
    judge: judge && {
      replayId: judge.replayId.value,
      compared: judge.compared,
      agreed: judge.agreed,
      pending: judge.pending,
      agreement: judge.agreement,
      unstable: judge.unstable,
    },
    checks: checks && {
      replayId: checks.replayId.value,
      rechecked: checks.rechecked,
      pending: checks.pending,
      flaky: checks.flaky.map((each) => ({
        taskId: each.taskId.value,
        originalRunId: each.original.value,
        runId: each.run.value,
        first: each.first,
        recheck: each.recheck,
      })),
    },
    oracle: oracle && {
      replayId: oracle.replayId.value,
      candidateId: oracle.candidateId.value,
      repeats: oracle.repeats,
      state: oracle.state,
      referenceReplayId: oracle.referenceReplayId?.value ?? null,
      referenceState: oracle.referenceState,
      answered: oracle.answered,
      live: oracle.live,
      withAnswer: oracle.withAnswer,
      gain: gainView(oracle.gain),
      roomToImprove: oracle.roomToImprove,
    },
  };
};

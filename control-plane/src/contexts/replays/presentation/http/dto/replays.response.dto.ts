import { ApiProperty } from '@nestjs/swagger';
import type {
  CheckConsistencyDto,
  FlakyCheckDto,
  GainEstimateDto,
  JudgeConsistencyDto,
  MoneyDto,
  OracleReadingDto,
  RateIntervalDto,
  SetHealthDto,
  SetNoiseDto,
  SetSaturationDto,
} from '@replays/application/dto/replays.dto';
import { GAIN_SIGNIFICANCES } from '@replays/domain/services/gain-estimate';
import {
  JUDGE_UNSTABLE_BELOW,
  SATURATED_ABOVE,
} from '@replays/domain/services/set-health';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';

export class RateIntervalResponseDto {
  @ApiProperty({
    example: 0.62,
    description:
      'The success rate: per task, the share of its judged repeats that succeeded, averaged over the tasks',
  })
  readonly rate: number;

  @ApiProperty({
    example: 0.48,
    description: 'The low end of the 95% interval, bootstrapped over the tasks',
  })
  readonly low: number;

  @ApiProperty({
    example: 0.75,
    description:
      'The high end of the 95% interval, bootstrapped over the tasks',
  })
  readonly high: number;

  constructor(interval: RateIntervalDto) {
    this.rate = interval.rate;
    this.low = interval.low;
    this.high = interval.high;
  }
}

export class GainEstimateResponseDto {
  @ApiProperty({
    example: 0.08,
    description:
      'The success rate gained over what it is compared with, on the tasks both scored',
  })
  readonly gain: number;

  @ApiProperty({
    example: -0.02,
    description:
      'The low end of the 95% interval of the gain, a paired bootstrap over the tasks',
  })
  readonly low: number;

  @ApiProperty({
    example: 0.18,
    description: 'The high end of the 95% interval of the gain',
  })
  readonly high: number;

  @ApiProperty({
    enum: GAIN_SIGNIFICANCES,
    description:
      'better when the whole interval is above nothing and the gain reaches the line’s min_gain; worse when the whole interval is below nothing and the loss reaches it; else within-noise',
  })
  readonly significance: string;

  @ApiProperty({
    example: 0.05,
    description: 'The smallest gain the line counts as real',
  })
  readonly minGain: number;

  @ApiProperty({ description: 'The tasks both sides scored, paired' })
  readonly tasks: number;

  constructor(gain: GainEstimateDto) {
    this.gain = gain.gain;
    this.low = gain.low;
    this.high = gain.high;
    this.significance = gain.significance;
    this.minGain = gain.minGain;
    this.tasks = gain.tasks;
  }
}

export class SetNoiseResponseDto {
  @ApiProperty({
    description:
      'The finished live replay, run more than once, the noise was measured on',
  })
  readonly replayId: string;

  @ApiProperty({ description: 'The live config fingerprint it replayed' })
  readonly fingerprint: string;

  @ApiProperty({ example: 3 })
  readonly repeats: number;

  @ApiProperty({
    type: Number,
    isArray: true,
    description: 'The success rate of each repeat of the set, in order',
  })
  readonly perRepeat: number[];

  @ApiProperty({
    example: 0.1,
    description: 'The highest repeat’s success rate less the lowest’s',
  })
  readonly spread: number;

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'Tasks whose repeats disagree, succeeding in one and failing in another',
  })
  readonly flippedTasks: string[];

  @ApiProperty()
  readonly measuredAt: string;

  @ApiProperty({
    description:
      'Whether the spread is too wide for a single repeat of each run to tell a gain of the line’s min_gain from chance, by the same rule the search warnings use',
  })
  readonly noisyInOneRepeat: boolean;

  constructor(noise: SetNoiseDto) {
    this.replayId = noise.replayId;
    this.fingerprint = noise.fingerprint;
    this.repeats = noise.repeats;
    this.perRepeat = [...noise.perRepeat];
    this.spread = noise.spread;
    this.flippedTasks = [...noise.flippedTasks];
    this.measuredAt = noise.measuredAt;
    this.noisyInOneRepeat = noise.noisyInOneRepeat;
  }
}

export const intervalResponse = (
  interval: RateIntervalDto | null,
): RateIntervalResponseDto | null =>
  interval ? new RateIntervalResponseDto(interval) : null;

export const gainResponse = (
  gain: GainEstimateDto | null,
): GainEstimateResponseDto | null =>
  gain ? new GainEstimateResponseDto(gain) : null;

export class SetSaturationResponseDto {
  @ApiProperty({
    description:
      'The newest finished replay of the live config over the whole set it was read from',
  })
  readonly replayId: string;

  @ApiProperty({ example: 0.97, description: 'The live config’s success rate' })
  readonly rate: number;

  @ApiProperty({ nullable: true, type: RateIntervalResponseDto })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({
    description: `Its success rate is above ${SATURATED_ABOVE}: a search has little room to succeed more, and looks for the same success at less cost unless told otherwise`,
  })
  readonly saturated: boolean;

  @ApiProperty()
  readonly measuredAt: string;

  constructor(saturation: SetSaturationDto) {
    this.replayId = saturation.replayId;
    this.rate = saturation.rate;
    this.interval = intervalResponse(saturation.interval);
    this.saturated = saturation.saturated;
    this.measuredAt = saturation.measuredAt;
  }
}

export class JudgeConsistencyResponseDto {
  @ApiProperty({
    description:
      'The calibration: the newest finished replay of the live config that checked the set',
  })
  readonly replayId: string;

  @ApiProperty({
    description: 'Changes the judge judged twice, both times with a verdict',
  })
  readonly compared: number;

  @ApiProperty({
    description: 'Of those, the ones it passed or failed alike both times',
  })
  readonly agreed: number;

  @ApiProperty({ description: 'Second judgings still to come' })
  readonly pending: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.92,
    description: 'agreed out of compared; null before any is compared',
  })
  readonly agreement: number | null;

  @ApiProperty({
    description: `It agreed with itself less than ${JUDGE_UNSTABLE_BELOW} of the time, so its verdicts are partly chance`,
  })
  readonly unstable: boolean;

  constructor(judge: JudgeConsistencyDto) {
    this.replayId = judge.replayId;
    this.compared = judge.compared;
    this.agreed = judge.agreed;
    this.pending = judge.pending;
    this.agreement = judge.agreement;
    this.unstable = judge.unstable;
  }
}

export class FlakyCheckResponseDto {
  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({ description: 'The original run the replay run replayed' })
  readonly originalRunId: string;

  @ApiProperty({
    description: 'The calibration’s replay run whose change flipped',
  })
  readonly runId: string;

  @ApiProperty({ enum: ['passed', 'failed'] })
  readonly first: string;

  @ApiProperty({ enum: ['passed', 'failed'] })
  readonly recheck: string;

  constructor(flaky: FlakyCheckDto) {
    this.taskId = flaky.taskId;
    this.originalRunId = flaky.originalRunId;
    this.runId = flaky.runId;
    this.first = flaky.first;
    this.recheck = flaky.recheck;
  }
}

export class CheckConsistencyResponseDto {
  @ApiProperty({
    description: 'The calibration whose changes were checked again',
  })
  readonly replayId: string;

  @ApiProperty({
    description: 'Changes checked twice, both times passing or failing',
  })
  readonly rechecked: number;

  @ApiProperty({ description: 'Second checks still to come' })
  readonly pending: number;

  @ApiProperty({
    type: FlakyCheckResponseDto,
    isArray: true,
    description: 'The changes whose check passed once and failed once',
  })
  readonly flaky: FlakyCheckResponseDto[];

  constructor(checks: CheckConsistencyDto) {
    this.replayId = checks.replayId;
    this.rechecked = checks.rechecked;
    this.pending = checks.pending;
    this.flaky = checks.flaky.map((each) => new FlakyCheckResponseDto(each));
  }
}

export class OracleReadingResponseDto {
  @ApiProperty({
    description:
      'The newest replay of the live config handed each run’s answer: the change people accepted, or the note they wrote when they sent it back',
  })
  readonly replayId: string;

  @ApiProperty()
  readonly candidateId: string;

  @ApiProperty()
  readonly repeats: number;

  @ApiProperty({ enum: REPLAY_STATES })
  readonly state: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The replay of the live config it is compared with: the one whose finishing started it',
  })
  readonly referenceReplayId: string | null;

  @ApiProperty({
    nullable: true,
    enum: [...REPLAY_STATES, 'gone', null],
    type: String,
    description:
      'The state of the replay that it is compared with: finished once they can be compared; stopped, ceiling-reached or gone means they never will be',
  })
  readonly referenceState: string | null;

  @ApiProperty({
    description:
      'Runs it replayed: those the live replay replayed whose original was accepted with a change, or sent back with a note from a person. Others have no answer to hand over',
  })
  readonly answered: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'The live config’s success on those runs; null until compared',
  })
  readonly live: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Success on those runs with the answer; null until compared',
  })
  readonly withAnswer: number | null;

  @ApiProperty({
    nullable: true,
    type: GainEstimateResponseDto,
    description:
      'The gain the answer brings over the live config: the most a better harness could gain on these runs',
  })
  readonly gain: GainEstimateResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description:
      'The answer did clearly better; false means the set leaves no room a better config could show, so a search on it would find little; null until compared, or when fewer than 5 runs had an answer',
  })
  readonly roomToImprove: boolean | null;

  constructor(oracle: OracleReadingDto) {
    this.replayId = oracle.replayId;
    this.candidateId = oracle.candidateId;
    this.repeats = oracle.repeats;
    this.state = oracle.state;
    this.referenceReplayId = oracle.referenceReplayId;
    this.referenceState = oracle.referenceState;
    this.answered = oracle.answered;
    this.live = oracle.live;
    this.withAnswer = oracle.withAnswer;
    this.gain = gainResponse(oracle.gain);
    this.roomToImprove = oracle.roomToImprove;
  }
}

export class SetHealthResponseDto {
  @ApiProperty({
    nullable: true,
    type: SetNoiseResponseDto,
    description:
      'How much its success rate moves between repeats of the same runs, from the newest finished replay of the live config that replayed each run more than once; null until one has',
  })
  readonly noise: SetNoiseResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: SetSaturationResponseDto,
    description:
      'How much of the set the live config passes already; null until it replayed the whole set',
  })
  readonly saturation: SetSaturationResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: JudgeConsistencyResponseDto,
    description:
      'How often the judge agrees with itself, from the set’s newest calibration; null until a calibration was judged',
  })
  readonly judge: JudgeConsistencyResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: CheckConsistencyResponseDto,
    description:
      'Whether the station’s check returns the same answer twice, from the set’s newest calibration; null until a calibration was checked',
  })
  readonly checks: CheckConsistencyResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: OracleReadingResponseDto,
    description:
      'How much better the live config does when handed each run’s answer. Started by Spotlight after each replay of the whole set under the live config; null until one started',
  })
  readonly oracle: OracleReadingResponseDto | null;

  constructor(health: SetHealthDto) {
    this.noise = health.noise ? new SetNoiseResponseDto(health.noise) : null;
    this.saturation = health.saturation
      ? new SetSaturationResponseDto(health.saturation)
      : null;
    this.judge = health.judge
      ? new JudgeConsistencyResponseDto(health.judge)
      : null;
    this.checks = health.checks
      ? new CheckConsistencyResponseDto(health.checks)
      : null;
    this.oracle = health.oracle
      ? new OracleReadingResponseDto(health.oracle)
      : null;
  }
}

export class MoneyResponseDto {
  @ApiProperty({ example: 4.2 })
  readonly amount: number;

  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  constructor(spend: MoneyDto) {
    this.amount = spend.amount;
    this.currency = spend.currency;
  }
}

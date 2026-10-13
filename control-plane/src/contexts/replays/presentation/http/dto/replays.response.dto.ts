import { ApiProperty } from '@nestjs/swagger';
import type {
  CandidateDto,
  CheckConsistencyDto,
  EntryChecksDto,
  EntryCitationDto,
  EntryCitedHunkDto,
  EntryCitedStepDto,
  EntryComparisonDto,
  EntryJudgeDto,
  EntryJudgeReasonDto,
  EntryPairDto,
  EntryPairReadingDto,
  EntryPairReasonDto,
  EntryReasonDto,
  FlakyCheckDto,
  GainReadingDto,
  JudgeConsistencyDto,
  ModelSpentDto,
  OracleReadingDto,
  PairTallyDto,
  RateIntervalDto,
  ReplayDetailDto,
  ReplayDto,
  ReplayEntryDto,
  ReplayOfRunDto,
  ReplaySearchDto,
  ReplayTotalsDto,
  SetHealthDto,
  SetNoiseDto,
  SetSaturationDto,
  SpendDto,
} from '@replays/application/dto/replays.dto';
import { GAIN_VERDICTS } from '@replays/domain/services/gain-reading';
import { SCORES_UNCOMPARED } from '@replays/domain/services/replay-results';
import {
  JUDGE_UNSTABLE_BELOW,
  SATURATED_ABOVE,
} from '@replays/domain/services/set-health';
import { CANDIDATE_KINDS } from '@replays/domain/value-objects/candidate-kind';
import { CHECKS_STATES } from '@replays/domain/value-objects/change-checks.vo';
import { CHECK_SKIPS } from '@replays/domain/value-objects/check-skip';
import { UNJUDGED_BECAUSE } from '@replays/domain/value-objects/entry-judging.vo';
import {
  PAIR_OUTCOMES,
  UNPAIRED_BECAUSE,
} from '@replays/domain/value-objects/entry-pairing.vo';
import { ENTRY_REASON_CODES } from '@replays/domain/value-objects/entry-reason';
import {
  JUDGE_SCALES,
  PASSING_SCORE,
} from '@replays/domain/value-objects/judge-verdict.vo';
import { REPLAY_ENDINGS } from '@replays/domain/value-objects/replay-ending';
import { REPLAY_REFUSALS } from '@replays/domain/value-objects/replay-refusal';
import { MOST_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { RUN_FAILURE_CODES } from '@shared-kernel/domain/value-objects/run-failure-code';

export class RateIntervalResponseDto {
  @ApiProperty({
    example: 0.62,
    description:
      'The success rate: per task, the share of its judged copies that succeeded, averaged over the tasks',
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

export class GainReadingResponseDto {
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
    enum: GAIN_VERDICTS,
    description:
      'better when the whole interval is above nothing and the gain reaches the line’s min_gain; worse when the whole interval is below nothing and the loss reaches it; else within-noise',
  })
  readonly verdict: string;

  @ApiProperty({
    example: 0.05,
    description: 'The smallest gain the line counts as real',
  })
  readonly minGain: number;

  @ApiProperty({ description: 'The tasks both sides scored, paired' })
  readonly tasks: number;

  constructor(gain: GainReadingDto) {
    this.gain = gain.gain;
    this.low = gain.low;
    this.high = gain.high;
    this.verdict = gain.verdict;
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
    description: 'The success rate of each copy of the set, in order',
  })
  readonly perRepeat: number[];

  @ApiProperty({
    example: 0.1,
    description: 'The highest copy’s success rate less the lowest’s',
  })
  readonly spread: number;

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'Tasks whose copies disagree, succeeding in one and failing in another',
  })
  readonly flippedTasks: string[];

  @ApiProperty()
  readonly measuredAt: string;

  @ApiProperty({
    description:
      'Whether the spread is too wide for a single copy of each run to tell a gain of the line’s min_gain from chance, by the same rule the search warnings use',
  })
  readonly noisyInOneCopy: boolean;

  constructor(noise: SetNoiseDto) {
    this.replayId = noise.replayId;
    this.fingerprint = noise.fingerprint;
    this.repeats = noise.repeats;
    this.perRepeat = [...noise.perRepeat];
    this.spread = noise.spread;
    this.flippedTasks = [...noise.flippedTasks];
    this.measuredAt = noise.measuredAt;
    this.noisyInOneCopy = noise.noisyInOneCopy;
  }
}

export const intervalResponse = (
  interval: RateIntervalDto | null,
): RateIntervalResponseDto | null =>
  interval ? new RateIntervalResponseDto(interval) : null;

export const gainResponse = (
  gain: GainReadingDto | null,
): GainReadingResponseDto | null =>
  gain ? new GainReadingResponseDto(gain) : null;

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
      'The probe: the newest finished replay of the live config that checked the set',
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

  @ApiProperty({ description: 'The probe’s replay run whose change flipped' })
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
  @ApiProperty({ description: 'The probe whose changes were checked again' })
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
      'The newest replay of the live config handed each run’s answer: the change people accepted, or what they said when they sent it back',
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
  readonly againstReplayId: string | null;

  @ApiProperty({
    nullable: true,
    enum: [...REPLAY_STATES, 'gone', null],
    type: String,
    description:
      'How the replay it is compared with stands: finished once they can be compared; stopped, over-budget or gone means they never will be',
  })
  readonly againstState: string | null;

  @ApiProperty({
    description:
      'Runs it replayed: those the live replay replayed whose original was accepted with a change, or sent back with something a person said. Others have no answer to hand over',
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
    type: GainReadingResponseDto,
    description:
      'The gain the answer brings over the live config: the most a better harness could gain on these runs',
  })
  readonly gain: GainReadingResponseDto | null;

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
    this.againstReplayId = oracle.againstReplayId;
    this.againstState = oracle.againstState;
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
      'How much its success rate moves between copies of the same runs, from the newest finished replay of the live config that replayed each run more than once; null until one has',
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
      'How often the judge agrees with itself, from the set’s newest probe; null until a probe was judged',
  })
  readonly judge: JudgeConsistencyResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: CheckConsistencyResponseDto,
    description:
      'Whether the station’s check gives the same answer twice, from the set’s newest probe; null until a probe was checked',
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

export class SpendResponseDto {
  @ApiProperty({ example: 4.2 })
  readonly amount: number;

  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  constructor(spend: SpendDto) {
    this.amount = spend.amount;
    this.currency = spend.currency;
  }
}

export class ModelSpentResponseDto {
  @ApiProperty({
    type: SpendResponseDto,
    isArray: true,
    description: 'One sum per currency the calls were priced in',
  })
  readonly spends: SpendResponseDto[];

  @ApiProperty({ description: 'Calls that came back with no price' })
  readonly unpriced: number;

  constructor(spent: ModelSpentDto) {
    this.spends = spent.spends.map((each) => new SpendResponseDto(each));
    this.unpriced = spent.unpriced;
  }
}

export class EntryReasonResponseDto {
  @ApiProperty({
    enum: ENTRY_REASON_CODES,
    description:
      'run-failed (detail: how; exited, refused or timed-out, the run failed through the candidate), asked-a-person, check-failed and judge-failed count against the replay; run-failed with unprepared, unprovisioned, hooks-unanswered, runner-lost or superseded (what ran it failed), unreplayable (detail: why it could not be replayed or started), run-stopped (the replay was stopped or ran over its ceiling), not-run, check-skipped (detail: why, as in no-check-asked), change-undrafted, no-change (it changed nothing for its check to run on), no-change-stack (it changed files, but no stack of them reached Spotlight), unjudged and nothing-judges leave it unscored; judged says why the judge passed it',
  })
  readonly code: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The refusal, failure or skip code, the failed check step or layer, or what the judge said',
  })
  readonly detail: string | null;

  @ApiProperty({
    type: Number,
    isArray: true,
    description: 'Journal steps of the replay run the judge cited',
  })
  readonly steps: number[];

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Hunks of the replay run’s change the judge cited',
  })
  readonly hunks: string[];

  constructor(reason: EntryReasonDto) {
    this.code = reason.code;
    this.detail = reason.detail;
    this.steps = [...reason.steps];
    this.hunks = [...reason.hunks];
  }
}

export class EntryChecksResponseDto {
  @ApiProperty({
    enum: CHECKS_STATES,
    description:
      'drafting or checking until its change stacks settle and their checks end; absent when its run left no change stack; none when its stacks are checked by nothing',
  })
  readonly state: string;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The steps or layers that failed',
  })
  readonly failedAt: string[];

  @ApiProperty({
    nullable: true,
    enum: [...CHECK_SKIPS, null],
    type: String,
    description:
      'Why it went unchecked: what stopped the runner checking it, undrafted when its change was never drafted, or skipped for anything else',
  })
  readonly why: string | null;

  constructor(checks: EntryChecksDto) {
    this.state = checks.state;
    this.failedAt = [...checks.failedAt];
    this.why = checks.why;
  }
}

export class EntryCitedStepResponseDto {
  @ApiProperty({
    example: 12,
    description: 'Where the step sits in the run’s journal',
  })
  readonly index: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Always null here: a replay keeps no copy of what the judge read',
  })
  readonly kind: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly tool: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly text: string | null;

  constructor(step: EntryCitedStepDto) {
    this.index = step.index;
    this.kind = step.kind;
    this.tool = step.tool;
    this.text = step.text;
  }
}

export class EntryCitedHunkResponseDto {
  @ApiProperty({ example: 'api/src/uploads.ts#2' })
  readonly id: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Always null here: a replay keeps no copy of what the judge read',
  })
  readonly path: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly header: string | null;

  @ApiProperty({ type: String, isArray: true })
  readonly lines: string[];

  constructor(hunk: EntryCitedHunkDto) {
    this.id = hunk.id;
    this.path = hunk.path;
    this.header = hunk.header;
    this.lines = [...hunk.lines];
  }
}

export class EntryCitationResponseDto {
  @ApiProperty({ enum: ['step', 'hunk'] })
  readonly kind: string;

  @ApiProperty({ type: EntryCitedStepResponseDto, nullable: true })
  readonly step: EntryCitedStepResponseDto | null;

  @ApiProperty({ type: EntryCitedHunkResponseDto, nullable: true })
  readonly hunk: EntryCitedHunkResponseDto | null;

  constructor(citation: EntryCitationDto) {
    this.kind = citation.kind;
    this.step = citation.step
      ? new EntryCitedStepResponseDto(citation.step)
      : null;
    this.hunk = citation.hunk
      ? new EntryCitedHunkResponseDto(citation.hunk)
      : null;
  }
}

export class EntryJudgeReasonResponseDto {
  @ApiProperty({ example: 'It retried the upload inside the request.' })
  readonly text: string;

  @ApiProperty({ type: EntryCitationResponseDto, isArray: true })
  readonly citations: EntryCitationResponseDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 0,
    description:
      'The place of the claim this reason is about, from 0; none on a rubric’s scale',
  })
  readonly claim: number | null;

  constructor(reason: EntryJudgeReasonDto) {
    this.text = reason.text;
    this.claim = reason.claim;
    this.citations = reason.citations.map(
      (each) => new EntryCitationResponseDto(each),
    );
  }
}

export class EntryJudgeResponseDto {
  @ApiProperty({ enum: ['asked', 'judged', 'unjudged'] })
  readonly state: string;

  @ApiProperty({ nullable: true, enum: [...JUDGE_SCALES, null], type: String })
  readonly scale: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      '0 or 1 on a yes-no rubric, 1 to 5 on a number one, or the share of claims met',
  })
  readonly score: number | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description: `Yes on a yes-no rubric, at least ${PASSING_SCORE} on a number one, or at least the pass share of claims met`,
  })
  readonly passed: boolean | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    isArray: true,
    example: [true, false, true],
    description:
      'Whether each claim was met, in order; null unless the judge goes by claims',
  })
  readonly marks: boolean[] | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 1,
    description:
      'The share of claims a run had to meet to pass; null unless the judge goes by claims',
  })
  readonly passShare: number | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description:
      'Whether it was judged against the change people accepted for the original run; without one, on the rubric alone',
  })
  readonly referenced: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  readonly model: string | null;

  @ApiProperty({
    nullable: true,
    enum: [...UNJUDGED_BECAUSE, null],
    type: String,
  })
  readonly unjudged: string | null;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['It adds a test that fails without it.'],
    description:
      'The claims the judge marked, in order, as worded when it judged; empty unless it goes by claims',
  })
  readonly claims: string[];

  @ApiProperty({
    type: EntryJudgeReasonResponseDto,
    isArray: true,
    description:
      'The judge’s grounded reasons, each naming the claim it is about on a claims judge',
  })
  readonly reasons: EntryJudgeReasonResponseDto[];

  constructor(judge: EntryJudgeDto) {
    this.state = judge.state;
    this.scale = judge.scale;
    this.score = judge.score;
    this.passed = judge.passed;
    this.referenced = judge.referenced;
    this.model = judge.model;
    this.unjudged = judge.unjudged;
    this.marks = judge.marks ? [...judge.marks] : null;
    this.passShare = judge.passShare;
    this.claims = [...judge.claims];
    this.reasons = judge.reasons.map(
      (each) => new EntryJudgeReasonResponseDto(each),
    );
  }
}

export class EntryPairReasonResponseDto {
  @ApiProperty({ example: 'Its change drains the queue in order.' })
  readonly text: string;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The hunks of this entry’s change the reason cites',
  })
  readonly ownHunks: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The hunks of the baseline’s change the reason cites',
  })
  readonly theirHunks: string[];

  constructor(reason: EntryPairReasonDto) {
    this.text = reason.text;
    this.ownHunks = [...reason.ownHunks];
    this.theirHunks = [...reason.theirHunks];
  }
}

export class EntryPairReadingResponseDto {
  @ApiProperty({
    description:
      'Whether this entry’s change was shown first, as A; each pair is read both ways round',
  })
  readonly ownShownFirst: boolean;

  @ApiProperty({ enum: PAIR_OUTCOMES })
  readonly outcome: string;

  @ApiProperty({ type: EntryPairReasonResponseDto, isArray: true })
  readonly reasons: EntryPairReasonResponseDto[];

  constructor(reading: EntryPairReadingDto) {
    this.ownShownFirst = reading.ownShownFirst;
    this.outcome = reading.outcome;
    this.reasons = reading.reasons.map(
      (each) => new EntryPairReasonResponseDto(each),
    );
  }
}

export class EntryPairResponseDto {
  @ApiProperty({ enum: ['asked', 'judged', 'unpaired'] })
  readonly state: string;

  @ApiProperty({
    description:
      'The run of the same task, in the replay in pairedWith, this change was set beside',
  })
  readonly againstRunId: string;

  @ApiProperty({
    nullable: true,
    enum: [...PAIR_OUTCOMES, null],
    type: String,
    description:
      'Whether the judge, not knowing which change was which, found this one better (win), worse (loss) or as good (tie)',
  })
  readonly outcome: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly model: string | null;

  @ApiProperty({
    nullable: true,
    enum: [...UNPAIRED_BECAUSE, null],
    type: String,
  })
  readonly unpaired: string | null;

  @ApiProperty({
    type: EntryPairReadingResponseDto,
    isArray: true,
    description:
      'The two readings, one with each change shown first; where they disagree the outcome is a tie',
  })
  readonly readings: EntryPairReadingResponseDto[];

  constructor(pair: EntryPairDto) {
    this.state = pair.state;
    this.againstRunId = pair.againstRunId;
    this.outcome = pair.outcome;
    this.model = pair.model;
    this.unpaired = pair.unpaired;
    this.readings = pair.readings.map(
      (each) => new EntryPairReadingResponseDto(each),
    );
  }
}

export class PairTallyResponseDto {
  @ApiProperty({
    example: 4,
    description: 'Tasks where the judge found the change better',
  })
  readonly wins: number;

  @ApiProperty({
    example: 1,
    description: 'Tasks where the judge found the change worse',
  })
  readonly losses: number;

  @ApiProperty({
    example: 2,
    description: 'Tasks where the judge found neither change better',
  })
  readonly ties: number;

  constructor(tally: PairTallyDto) {
    this.wins = tally.wins;
    this.losses = tally.losses;
    this.ties = tally.ties;
  }
}

export class ReplayEntryResponseDto {
  @ApiProperty({ example: 0 })
  readonly position: number;

  @ApiProperty({ description: 'The past run it replays' })
  readonly originalRunId: string;

  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({
    example: 1,
    description: 'Which copy of the original run this is, from 1',
  })
  readonly repeat: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The replay run, once one is queued',
  })
  readonly runId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The StationConfig fingerprint the replay run was queued under; it can drift from the candidate’s when the line changed since',
  })
  readonly fingerprint: string | null;

  @ApiProperty({ enum: ['waiting', 'dispatched', 'settled'] })
  readonly phase: string;

  @ApiProperty({
    enum: [...REPLAY_ENDINGS, null],
    nullable: true,
    type: String,
  })
  readonly ending: string | null;

  @ApiProperty({
    enum: [...REPLAY_REFUSALS, null],
    nullable: true,
    type: String,
  })
  readonly refusal: string | null;

  @ApiProperty({
    nullable: true,
    enum: [...RUN_FAILURE_CODES, null],
    type: String,
    description:
      'How its run failed: exited, refused and timed-out (it ran past its host’s time limit) count against the candidate; unprepared, unprovisioned, hooks-unanswered, runner-lost and superseded were down to what ran it, and leave the entry unscored',
  })
  readonly failure: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Where its handover would have sent the task',
  })
  readonly next: string | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly ms: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly steps: number | null;

  @ApiProperty({ nullable: true, type: SpendResponseDto })
  readonly cost: SpendResponseDto | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly inputTokens: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly outputTokens: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly cacheReadTokens: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly cacheWriteTokens: number | null;

  @ApiProperty({ nullable: true, type: EntryChecksResponseDto })
  readonly checks: EntryChecksResponseDto | null;

  @ApiProperty({ nullable: true, type: EntryJudgeResponseDto })
  readonly judge: EntryJudgeResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: ModelSpentResponseDto,
    description:
      'What drafting and reordering its change stacks cost, failed calls included; what is in the ceiling’s currency is spent against it',
  })
  readonly draftingSpent: ModelSpentResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: ModelSpentResponseDto,
    description:
      'What judging its change cost, unreadable answers included; what is in the ceiling’s currency is spent against it',
  })
  readonly judgingSpent: ModelSpentResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: EntryJudgeResponseDto,
    description:
      'A probe’s second judging of the same change, to see whether the judge agrees with itself; it never changes the run’s result',
  })
  readonly secondJudge: EntryJudgeResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: ModelSpentResponseDto,
    description:
      'What the second judging cost; what is in the ceiling’s currency is spent against it',
  })
  readonly rejudgingSpent: ModelSpentResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: EntryChecksResponseDto,
    description:
      'A probe’s second check of the same change, to see whether the check is flaky; it never changes the run’s result',
  })
  readonly recheck: EntryChecksResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: EntryPairResponseDto,
    description:
      'Its change set side by side with that of the replay in pairedWith for the same task, judged blind both ways round; it never changes the run’s result',
  })
  readonly pair: EntryPairResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: ModelSpentResponseDto,
    description:
      'What the side-by-side judging cost; what is in the ceiling’s currency is spent against it',
  })
  readonly pairingSpent: ModelSpentResponseDto | null;

  @ApiProperty({
    enum: ['pending', 'succeeded', 'failed', 'unscored'],
    description:
      'pending while its run, checks or judge are still to come; unscored when nothing could say whether it succeeded',
  })
  readonly result: string;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description:
      'Its candidate’s own checks passed, or it has none, and its judge, where it has one, passed it; null while pending or unscored',
  })
  readonly succeeded: boolean | null;

  @ApiProperty({ type: EntryReasonResponseDto, isArray: true })
  readonly reasons: EntryReasonResponseDto[];

  constructor(entry: ReplayEntryDto) {
    this.position = entry.position;
    this.originalRunId = entry.originalRunId;
    this.taskId = entry.taskId;
    this.repeat = entry.repeat;
    this.runId = entry.runId;
    this.fingerprint = entry.fingerprint;
    this.phase = entry.phase;
    this.ending = entry.ending;
    this.refusal = entry.refusal;
    this.failure = entry.failure;
    this.next = entry.next;
    this.ms = entry.ms;
    this.steps = entry.steps;
    this.cost = entry.cost ? new SpendResponseDto(entry.cost) : null;
    this.inputTokens = entry.inputTokens;
    this.outputTokens = entry.outputTokens;
    this.cacheReadTokens = entry.cacheReadTokens;
    this.cacheWriteTokens = entry.cacheWriteTokens;
    this.checks = entry.checks
      ? new EntryChecksResponseDto(entry.checks)
      : null;
    this.judge = entry.judge ? new EntryJudgeResponseDto(entry.judge) : null;
    this.draftingSpent = entry.draftingSpent
      ? new ModelSpentResponseDto(entry.draftingSpent)
      : null;
    this.judgingSpent = entry.judgingSpent
      ? new ModelSpentResponseDto(entry.judgingSpent)
      : null;
    this.secondJudge = entry.secondJudge
      ? new EntryJudgeResponseDto(entry.secondJudge)
      : null;
    this.rejudgingSpent = entry.rejudgingSpent
      ? new ModelSpentResponseDto(entry.rejudgingSpent)
      : null;
    this.recheck = entry.recheck
      ? new EntryChecksResponseDto(entry.recheck)
      : null;
    this.pair = entry.pair ? new EntryPairResponseDto(entry.pair) : null;
    this.pairingSpent = entry.pairingSpent
      ? new ModelSpentResponseDto(entry.pairingSpent)
      : null;
    this.result = entry.result;
    this.succeeded = entry.succeeded;
    this.reasons = entry.reasons.map(
      (each) => new EntryReasonResponseDto(each),
    );
  }
}

export class ReplayTotalsResponseDto {
  @ApiProperty()
  readonly entries: number;

  @ApiProperty()
  readonly settled: number;

  @ApiProperty()
  readonly completed: number;

  @ApiProperty()
  readonly failed: number;

  @ApiProperty()
  readonly stopped: number;

  @ApiProperty()
  readonly asked: number;

  @ApiProperty()
  readonly unreplayable: number;

  @ApiProperty()
  readonly notRun: number;

  @ApiProperty({ nullable: true, type: Number })
  readonly succeeded: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Per task, the share of its scored copies that succeeded, averaged over the tasks scored',
  })
  readonly successRate: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({ description: 'Entries that succeeded or failed' })
  readonly scored: number;

  @ApiProperty({ description: 'Original runs it replays, each once or more' })
  readonly tasks: number;

  @ApiProperty({ description: 'Original runs with at least one scored copy' })
  readonly tasksScored: number;

  @ApiProperty({
    description: 'Entries done that nothing could score',
  })
  readonly unscored: number;

  @ApiProperty({
    type: SpendResponseDto,
    description: 'What it spent in the ceiling’s currency, counted against it',
  })
  readonly spent: SpendResponseDto;

  @ApiProperty({
    type: SpendResponseDto,
    isArray: true,
    description:
      'What it spent in other currencies, one sum each; none of it counts against the ceiling',
  })
  readonly spentElsewhere: SpendResponseDto[];

  @ApiProperty({
    description: 'Runs whose cost was never reported',
  })
  readonly unpriced: number;

  @ApiProperty({
    description:
      'Model calls, for drafting change stacks or judging, that came back with no price',
  })
  readonly unpricedCalls: number;

  @ApiProperty()
  readonly steps: number;

  @ApiProperty({ nullable: true, type: Number })
  readonly medianSteps: number | null;

  @ApiProperty()
  readonly ms: number;

  @ApiProperty({ nullable: true, type: Number })
  readonly medianMs: number | null;

  constructor(totals: ReplayTotalsDto) {
    this.entries = totals.entries;
    this.settled = totals.settled;
    this.completed = totals.completed;
    this.failed = totals.failed;
    this.stopped = totals.stopped;
    this.asked = totals.asked;
    this.unreplayable = totals.unreplayable;
    this.notRun = totals.notRun;
    this.succeeded = totals.succeeded;
    this.successRate = totals.successRate;
    this.interval = intervalResponse(totals.interval);
    this.scored = totals.scored;
    this.tasks = totals.tasks;
    this.tasksScored = totals.tasksScored;
    this.unscored = totals.unscored;
    this.spent = new SpendResponseDto(totals.spent);
    this.spentElsewhere = totals.spentElsewhere.map(
      (each) => new SpendResponseDto(each),
    );
    this.unpriced = totals.unpriced;
    this.unpricedCalls = totals.unpricedCalls;
    this.steps = totals.steps;
    this.medianSteps = totals.medianSteps;
    this.ms = totals.ms;
    this.medianMs = totals.medianMs;
  }
}

export class CandidateResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({ example: 'Shorter prompt' })
  readonly name: string;

  @ApiProperty({ enum: CANDIDATE_KINDS })
  readonly kind: string;

  @ApiProperty({
    description: 'The StationConfig fingerprint, as runs record it',
  })
  readonly fingerprint: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The station block, as the line resource holds it',
  })
  readonly station: Record<string, unknown>;

  @ApiProperty()
  readonly createdAt: string;

  constructor(candidate: CandidateDto) {
    this.id = candidate.id;
    this.name = candidate.name;
    this.kind = candidate.kind;
    this.fingerprint = candidate.fingerprint;
    this.station = { ...candidate.station };
    this.createdAt = candidate.createdAt;
  }
}

export class ReplayResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty()
  readonly setId: string;

  @ApiProperty({ nullable: true, type: CandidateResponseDto })
  readonly candidate: CandidateResponseDto | null;

  @ApiProperty({ description: 'Started as a baseline of the live config' })
  readonly startedAsBaseline: boolean;

  @ApiProperty({ description: 'The set’s baseline, compared against' })
  readonly isBaseline: boolean;

  @ApiProperty({
    description: 'Its candidate has a judge, which scores every replay run',
  })
  readonly judges: boolean;

  @ApiProperty({
    description:
      'Its candidate checks the change each replay run leaves; a run that leaves no change stack then goes unscored',
  })
  readonly checks: boolean;

  @ApiProperty({ enum: REPLAY_STATES })
  readonly state: string;

  @ApiProperty({ type: SpendResponseDto })
  readonly ceiling: SpendResponseDto;

  @ApiProperty({
    example: 1,
    description: 'How many times it replays each run of its set',
  })
  readonly repeats: number;

  @ApiProperty({
    description:
      'It probes the set: once it finishes, each judged change is judged again and each checked change checked again, to see whether the judge and the check give the same answer twice',
  })
  readonly probe: boolean;

  @ApiProperty()
  readonly startedAt: string;

  @ApiProperty({ nullable: true, type: String })
  readonly endedAt: string | null;

  @ApiProperty({ type: ReplayTotalsResponseDto })
  readonly totals: ReplayTotalsResponseDto;

  @ApiProperty({
    nullable: true,
    type: GainReadingResponseDto,
    description:
      'Its gain in success over the replay it is compared with (pairedWith where set, else the set’s baseline), with whether it is within noise; null with none',
  })
  readonly againstBaseline: GainReadingResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The replay its changes are set beside, judged blind: the baseline standing when it started, or its search’s seed; null for a baseline, a probe or a replay that had none',
  })
  readonly pairedWith: string | null;

  @ApiProperty({
    nullable: true,
    type: PairTallyResponseDto,
    description:
      'Tasks whose change the judge, comparing it blind with the change of the replay in pairedWith, found better, worse or as good; null where pairedWith is',
  })
  readonly pairsAgainstBaseline: PairTallyResponseDto | null;

  @ApiProperty({ type: ReplayEntryResponseDto, isArray: true })
  readonly entries: ReplayEntryResponseDto[];

  constructor(replay: ReplayDto) {
    this.id = replay.id;
    this.setId = replay.setId;
    this.candidate = replay.candidate
      ? new CandidateResponseDto(replay.candidate)
      : null;
    this.startedAsBaseline = replay.startedAsBaseline;
    this.isBaseline = replay.isBaseline;
    this.judges = replay.judges;
    this.checks = replay.checks;
    this.state = replay.state;
    this.ceiling = new SpendResponseDto(replay.ceiling);
    this.repeats = replay.repeats;
    this.probe = replay.probe;
    this.startedAt = replay.startedAt;
    this.endedAt = replay.endedAt;
    this.totals = new ReplayTotalsResponseDto(replay.totals);
    this.againstBaseline = gainResponse(replay.againstBaseline);
    this.pairedWith = replay.pairedWith;
    this.pairsAgainstBaseline = replay.pairsAgainstBaseline
      ? new PairTallyResponseDto(replay.pairsAgainstBaseline)
      : null;
    this.entries = replay.entries.map(
      (each) => new ReplayEntryResponseDto(each),
    );
  }
}

export class EntryComparisonResponseDto {
  @ApiProperty()
  readonly originalRunId: string;

  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The title of the task the original run worked, as it reads now; null once the task is deleted',
  })
  readonly title: string | null;

  @ApiProperty({
    type: ReplayEntryResponseDto,
    isArray: true,
    description: 'Each copy of the task the candidate replayed',
  })
  readonly candidate: ReplayEntryResponseDto[];

  @ApiProperty({
    type: ReplayEntryResponseDto,
    isArray: true,
    description:
      'Each copy of the task the baseline replayed; none without one',
  })
  readonly baseline: ReplayEntryResponseDto[];

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'The share of the candidate’s scored copies that succeeded',
  })
  readonly candidateSuccess: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'The share of the baseline’s scored copies that succeeded',
  })
  readonly baselineSuccess: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Candidate cost less the baseline’s, each averaged over its copies, once both settled',
  })
  readonly costDelta: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly msDelta: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly stepsDelta: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Candidate judge score less the baseline’s, where both were judged on the same scale',
  })
  readonly scoreDelta: number | null;

  @ApiProperty({
    nullable: true,
    enum: [...SCORES_UNCOMPARED, null],
    type: String,
    description:
      'Why there is no score delta: one side was not judged, or the two were judged by different rubrics or one against a reference the other lacked',
  })
  readonly scoreUncompared: string | null;

  @ApiProperty({
    description:
      'The baseline’s share of copies that succeeded is more than half above the candidate’s (with one copy each: the baseline succeeded and the candidate failed), or its average judge score dropped',
  })
  readonly regressed: boolean;

  @ApiProperty({
    nullable: true,
    enum: [...PAIR_OUTCOMES, null],
    type: String,
    description:
      'Whether the judge, comparing the candidate’s change blind with that of the replay in pairedWith, found it better (win), worse (loss) or as good (tie), by most of its copies; null where none was compared so',
  })
  readonly pair: string | null;

  constructor(compared: EntryComparisonDto) {
    this.originalRunId = compared.originalRunId;
    this.taskId = compared.taskId;
    this.title = compared.title;
    this.candidate = compared.candidate.map(
      (each) => new ReplayEntryResponseDto(each),
    );
    this.baseline = compared.baseline.map(
      (each) => new ReplayEntryResponseDto(each),
    );
    this.candidateSuccess = compared.candidateSuccess;
    this.baselineSuccess = compared.baselineSuccess;
    this.costDelta = compared.costDelta;
    this.msDelta = compared.msDelta;
    this.stepsDelta = compared.stepsDelta;
    this.scoreDelta = compared.scoreDelta;
    this.scoreUncompared = compared.scoreUncompared;
    this.regressed = compared.regressed;
    this.pair = compared.pair;
  }
}

export class ReplaySearchResponseDto {
  @ApiProperty({ description: 'The search the replay belongs to' })
  readonly searchId: string;

  @ApiProperty({
    example: 'terse-prompt',
    description:
      'The candidate it replays in that search; seed for the live config the search started from',
  })
  readonly candidateName: string;

  constructor(search: ReplaySearchDto) {
    this.searchId = search.searchId;
    this.candidateName = search.candidateName;
  }
}

export class ReplayDetailResponseDto extends ReplayResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly baselineReplayId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The replay its comparison rows, gain and deltas are against: pairedWith where set, else the set’s baseline; null for the baseline itself or with none',
  })
  readonly comparedWithReplayId: string | null;

  @ApiProperty({
    nullable: true,
    type: ReplaySearchResponseDto,
    description: 'The search it belongs to, when a search started it',
  })
  readonly search: ReplaySearchResponseDto | null;

  @ApiProperty({
    type: EntryComparisonResponseDto,
    isArray: true,
    description: 'Per task against the set’s baseline, regressions first',
  })
  readonly comparison: EntryComparisonResponseDto[];

  constructor(replay: ReplayDetailDto) {
    super(replay);
    this.baselineReplayId = replay.baselineReplayId;
    this.comparedWithReplayId = replay.comparedWithReplayId;
    this.search = replay.search
      ? new ReplaySearchResponseDto(replay.search)
      : null;
    this.comparison = replay.comparison.map(
      (each) => new EntryComparisonResponseDto(each),
    );
  }
}

export class StartReplayCeilingRequestDto {
  @ApiProperty({
    example: 5,
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 1000,
  })
  readonly amount!: number;

  @ApiProperty({ example: 'USD' })
  readonly currency!: string;
}

export class StartReplayRequestDto {
  @ApiProperty({
    example: 'live',
    description: 'A candidate’s id, or live for the station as configured now',
  })
  readonly candidate!: string;

  @ApiProperty({ type: StartReplayCeilingRequestDto })
  readonly ceiling!: StartReplayCeilingRequestDto;

  @ApiProperty({
    required: false,
    example: 1,
    minimum: 1,
    maximum: MOST_REPEATS,
    description:
      'How many times to replay each run, 1 when left out; more copies measure the set’s noise and narrow the intervals',
  })
  readonly repeats?: number;
}

export class StartedBaselineResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({
    type: SpendResponseDto,
    description: 'Its own ceiling, the same as the one asked for',
  })
  readonly ceiling: SpendResponseDto;

  @ApiProperty({
    enum: ['started', 'starting'],
    description:
      'started: this replay is the baseline; starting: it starts shortly, unless another baseline covers the set by then, which reads then name',
  })
  readonly status: string;

  constructor(id: string, ceiling: SpendDto, status: string) {
    this.id = id;
    this.ceiling = new SpendResponseDto(ceiling);
    this.status = status;
  }
}

export class ReplayStartedResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({
    type: SpendResponseDto,
    description: 'The most this replay may spend, on its own',
  })
  readonly ceiling: SpendResponseDto;

  @ApiProperty({
    nullable: true,
    type: StartedBaselineResponseDto,
    description:
      'The set’s baseline replay of the live config, when the set had none covering its runs: this replay itself, or one starting beside it under this id. It spends against a ceiling of its own, equal to the one asked for, so the two together may spend up to twice it',
  })
  readonly baseline: StartedBaselineResponseDto | null;

  constructor(started: {
    readonly id: string;
    readonly ceiling: SpendDto;
    readonly baseline: {
      readonly id: string;
      readonly ceiling: SpendDto;
      readonly status: string;
    } | null;
  }) {
    this.id = started.id;
    this.ceiling = new SpendResponseDto(started.ceiling);
    this.baseline = started.baseline
      ? new StartedBaselineResponseDto(
          started.baseline.id,
          started.baseline.ceiling,
          started.baseline.status,
        )
      : null;
  }
}

export class ReplayOfRunResponseDto {
  @ApiProperty()
  readonly replayId: string;

  @ApiProperty()
  readonly setId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Queue fixes',
    description: 'Its set’s name; null once the set is gone',
  })
  readonly setName: string | null;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ nullable: true, type: CandidateResponseDto })
  readonly candidate: CandidateResponseDto | null;

  @ApiProperty({ description: 'Started as a baseline of the live config' })
  readonly startedAsBaseline: boolean;

  @ApiProperty({ description: 'The set’s baseline, compared against' })
  readonly isBaseline: boolean;

  @ApiProperty({ enum: REPLAY_STATES })
  readonly state: string;

  @ApiProperty({
    nullable: true,
    type: ReplayEntryResponseDto,
    description: 'The run’s entry in the replay, with its result',
  })
  readonly entry: ReplayEntryResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: ReplaySearchResponseDto,
    description: 'The search its replay belongs to, when a search started it',
  })
  readonly search: ReplaySearchResponseDto | null;

  constructor(found: ReplayOfRunDto) {
    this.replayId = found.replayId;
    this.setId = found.setId;
    this.setName = found.setName;
    this.lineId = found.lineId;
    this.stationId = found.stationId;
    this.candidate = found.candidate
      ? new CandidateResponseDto(found.candidate)
      : null;
    this.startedAsBaseline = found.startedAsBaseline;
    this.isBaseline = found.isBaseline;
    this.state = found.state;
    this.entry = found.entry ? new ReplayEntryResponseDto(found.entry) : null;
    this.search = found.search
      ? new ReplaySearchResponseDto(found.search)
      : null;
  }
}

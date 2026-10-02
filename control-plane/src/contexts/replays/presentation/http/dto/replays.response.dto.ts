import { ApiProperty } from '@nestjs/swagger';
import type {
  CandidateDto,
  EntryChecksDto,
  EntryComparisonDto,
  EntryJudgeDto,
  EntryReasonDto,
  ModelSpentDto,
  ReplayDetailDto,
  ReplayDto,
  ReplayEntryDto,
  ReplayOfRunDto,
  ReplaySearchDto,
  ReplayTotalsDto,
  SpendDto,
} from '@replays/application/dto/replays.dto';
import { SCORES_UNCOMPARED } from '@replays/domain/services/replay-results';
import { CANDIDATE_KINDS } from '@replays/domain/value-objects/candidate-kind';
import { CHECKS_STATES } from '@replays/domain/value-objects/change-checks.vo';
import { CHECK_SKIPS } from '@replays/domain/value-objects/check-skip';
import { UNJUDGED_BECAUSE } from '@replays/domain/value-objects/entry-judging.vo';
import { ENTRY_REASON_CODES } from '@replays/domain/value-objects/entry-reason';
import {
  JUDGE_SCALES,
  PASSING_SCORE,
} from '@replays/domain/value-objects/judge-verdict.vo';
import { REPLAY_ENDINGS } from '@replays/domain/value-objects/replay-ending';
import { REPLAY_REFUSALS } from '@replays/domain/value-objects/replay-refusal';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { RUN_FAILURE_CODES } from '@shared-kernel/domain/value-objects/run-failure-code';

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

export class EntryJudgeResponseDto {
  @ApiProperty({ enum: ['asked', 'judged', 'unjudged'] })
  readonly state: string;

  @ApiProperty({ nullable: true, enum: [...JUDGE_SCALES, null], type: String })
  readonly scale: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: '0 or 1 on a yes-no rubric, 1 to 5 on a number one',
  })
  readonly score: number | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description: `Yes on a yes-no rubric, or at least ${PASSING_SCORE} on a number one`,
  })
  readonly passed: boolean | null;

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

  constructor(judge: EntryJudgeDto) {
    this.state = judge.state;
    this.scale = judge.scale;
    this.score = judge.score;
    this.passed = judge.passed;
    this.referenced = judge.referenced;
    this.model = judge.model;
    this.unjudged = judge.unjudged;
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
    description: 'Of the scored entries, the share that succeeded',
  })
  readonly successRate: number | null;

  @ApiProperty({ description: 'Entries that succeeded or failed' })
  readonly scored: number;

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
    this.scored = totals.scored;
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

  @ApiProperty()
  readonly startedAt: string;

  @ApiProperty({ nullable: true, type: String })
  readonly endedAt: string | null;

  @ApiProperty({ type: ReplayTotalsResponseDto })
  readonly totals: ReplayTotalsResponseDto;

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
    this.startedAt = replay.startedAt;
    this.endedAt = replay.endedAt;
    this.totals = new ReplayTotalsResponseDto(replay.totals);
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

  @ApiProperty({ type: ReplayEntryResponseDto })
  readonly candidate: ReplayEntryResponseDto;

  @ApiProperty({ nullable: true, type: ReplayEntryResponseDto })
  readonly baseline: ReplayEntryResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Candidate cost less the baseline’s, once both settled',
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
      'The baseline succeeded on this task and the candidate failed, or its judge score dropped',
  })
  readonly regressed: boolean;

  constructor(compared: EntryComparisonDto) {
    this.originalRunId = compared.originalRunId;
    this.taskId = compared.taskId;
    this.title = compared.title;
    this.candidate = new ReplayEntryResponseDto(compared.candidate);
    this.baseline = compared.baseline
      ? new ReplayEntryResponseDto(compared.baseline)
      : null;
    this.costDelta = compared.costDelta;
    this.msDelta = compared.msDelta;
    this.stepsDelta = compared.stepsDelta;
    this.scoreDelta = compared.scoreDelta;
    this.scoreUncompared = compared.scoreUncompared;
    this.regressed = compared.regressed;
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

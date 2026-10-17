import { ApiProperty } from '@nestjs/swagger';
import type {
  LineReplayCheckSummary,
  LineSourceSummary,
  StationAlertSummary,
  StationJudgeSummary,
} from '@work/application/ports/line-reader.port';
import { ALERT_MEASURES } from '@work/domain/value-objects/station-alert.vo';

export class StationJudgeResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'A good run changes only what the task asks for.',
    description:
      'What a good run looks like, in Markdown. Null when the judge goes by its claims alone',
  })
  readonly rubric: string | null;

  @ApiProperty({
    type: [String],
    example: ['The change adds a test that fails without it.'],
    description:
      'Checkable claims the judge marks met or unmet, in order. Empty when the judge goes by its rubric',
  })
  readonly claims: string[];

  @ApiProperty({
    example: 1,
    description:
      'The share of claims a run must meet to pass, from 0 to 1. 1 means every claim',
  })
  readonly passShare: number;

  @ApiProperty({
    example: 0.2,
    description: 'The share of runs judged, from 0 to 1',
  })
  readonly sample: number;

  @ApiProperty({
    example: 0.6,
    description:
      'How often the judge must agree with people, from 0 to 1, before its scores show',
  })
  readonly trust: number;

  constructor(judge: StationJudgeSummary) {
    this.rubric = judge.rubric;
    this.claims = [...judge.claims];
    this.passShare = judge.passShare;
    this.sample = judge.sample;
    this.trust = judge.trust;
  }
}

export class StationAlertResponseDto {
  @ApiProperty({ enum: ALERT_MEASURES, example: 'sent_back_rate' })
  readonly measure: string;

  @ApiProperty({
    example: 0.2,
    nullable: true,
    type: Number,
    description:
      "Goes off when the measure over the last `over` runs is this much higher than over the `over` runs before. For a rate, a share above 0 and at most 1 (0.2 is 20 percentage points); for `cost_per_run`, an amount above 0 in the workspace's currency. Exactly one of `risesBy`, `above`, `fallsBy` and `below` is set.",
  })
  readonly risesBy: number | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: Number,
    description:
      "Goes off when the measure across the last `over` runs is higher than this. For a rate, a share from 0 to 1; for `cost_per_run`, an amount of 0 or more in the workspace's currency. Exactly one of `risesBy`, `above`, `fallsBy` and `below` is set.",
  })
  readonly above: number | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: Number,
    description:
      "Goes off when the measure over the last `over` runs is this much lower than over the `over` runs before. For a rate, a share above 0 and at most 1 (0.2 is 20 percentage points); for `cost_per_run`, an amount above 0 in the workspace's currency. Exactly one of `risesBy`, `above`, `fallsBy` and `below` is set.",
  })
  readonly fallsBy: number | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: Number,
    description:
      "Goes off when the measure across the last `over` runs is lower than this. For a rate, a share from 0 to 1; for `cost_per_run`, an amount of 0 or more in the workspace's currency. Exactly one of `risesBy`, `above`, `fallsBy` and `below` is set.",
  })
  readonly below: number | null;

  @ApiProperty({ example: 20, description: 'How many runs are compared' })
  readonly over: number;

  constructor(alert: StationAlertSummary) {
    this.measure = alert.measure;
    this.risesBy = alert.risesBy;
    this.above = alert.above;
    this.fallsBy = alert.fallsBy;
    this.below = alert.below;
    this.over = alert.over;
  }
}

export class StationResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly id: string;

  @ApiProperty({
    example: 'triage',
    description:
      'What the station is called in its line definition, and what a run hands a task on to it by',
  })
  readonly key: string;

  @ApiProperty({ example: 'Triage' })
  readonly name: string;

  @ApiProperty({ example: 0, description: 'Left to right across the board' })
  readonly position: number;

  @ApiProperty({ example: '#5c66d9', description: 'Six digit hex' })
  readonly color: string;

  @ApiProperty({
    example: 'Where new work lands before anyone looks at it',
    nullable: true,
    type: String,
  })
  readonly description: string | null;

  @ApiProperty({
    example: 'dev',
    nullable: true,
    type: String,
    description: 'Which runners work this station. Null until one is chosen.',
  })
  readonly harness: string | null;

  @ApiProperty({
    example: 'claude-sonnet-5',
    nullable: true,
    type: String,
    description:
      'Which model the harness answers with. Null falls back to its default.',
  })
  readonly model: string | null;

  @ApiProperty({
    example: 'high',
    nullable: true,
    type: String,
    description:
      'How hard the harness is told to think. Null leaves its own default.',
  })
  readonly effort: string | null;

  @ApiProperty({
    example: '## Role\n\nSort the queue.',
    nullable: true,
    type: String,
    description: 'Markdown, handed to the agent that works this station',
  })
  readonly agentPrompt: string | null;

  @ApiProperty({
    type: StationJudgeResponseDto,
    nullable: true,
    description:
      'Scores the station’s runs against a rubric. Null when none is set.',
  })
  readonly judge: StationJudgeResponseDto | null;

  @ApiProperty({
    type: StationAlertResponseDto,
    isArray: true,
    description:
      'When a measure of the station’s runs worsens enough to warn about, in the order they were written',
  })
  readonly alerts: StationAlertResponseDto[];

  @ApiProperty({
    enum: ['backlog', 'work', 'completed'],
    description:
      'The ends of the line: a backlog is where a task waits before anything works it, and completed is where it lands once its pull request is merged',
  })
  readonly kind: string;

  @ApiProperty({
    example: ['our-migrations'],
    isArray: true,
    type: String,
    description: 'The team’s own skills given to a run here',
  })
  readonly skills: string[];

  constructor(
    id: string,
    key: string,
    name: string,
    position: number,
    color: string,
    description: string | null,
    harness: string | null,
    model: string | null,
    effort: string | null,
    agentPrompt: string | null,
    judge: StationJudgeSummary | null,
    alerts: readonly StationAlertSummary[],
    kind: string,
    skills: readonly string[],
  ) {
    this.id = id;
    this.key = key;
    this.name = name;
    this.position = position;
    this.color = color;
    this.description = description;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.agentPrompt = agentPrompt;
    this.judge = judge ? new StationJudgeResponseDto(judge) : null;
    this.alerts = alerts.map((each) => new StationAlertResponseDto(each));
    this.kind = kind;
    this.skills = [...skills];
  }
}

export class ReactionResponseDto {
  @ApiProperty({ example: 'github.pull_request.commented' })
  readonly happening: string;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description:
      'The station where the task must be for this to count. Null means any station.',
  })
  readonly from: string | null;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly to: string;

  constructor(happening: string, from: string | null, to: string) {
    this.happening = happening;
    this.from = from;
    this.to = to;
  }
}

export class LineSourceResponseDto {
  @ApiProperty({
    example: 'acme/platform',
    description: 'The GitHub repository that contains the line’s Terraform',
  })
  readonly repository: string;

  @ApiProperty({
    example: 'teams/core/delivery.tf',
    description:
      'The Terraform file in it that contains the line, from the repository root',
  })
  readonly path: string;

  constructor(source: LineSourceSummary) {
    this.repository = source.repository;
    this.path = source.path;
  }
}

export class LineReplayCheckResponseDto {
  @ApiProperty({
    example: 0,
    description:
      'How many tasks a planned change may regress on and still pass `spotlight replay check`',
  })
  readonly maxRegressions: number;

  @ApiProperty({
    example: 10,
    description: 'The most one check’s replay may spend',
  })
  readonly ceiling: number;

  @ApiProperty({ example: 'USD', description: 'The currency of the ceiling' })
  readonly currency: string;

  @ApiProperty({
    example: 0.05,
    description:
      'The smallest gain in success, as a share, that counts as more than noise when replays are compared',
  })
  readonly minGain: number;

  constructor(check: LineReplayCheckSummary) {
    this.maxRegressions = check.maxRegressions;
    this.ceiling = check.ceiling;
    this.currency = check.currency;
    this.minGain = check.minGain;
  }
}

export class LineResponseDto {
  @ApiProperty({ example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  readonly id: string;

  @ApiProperty({
    example: 'delivery',
    description: 'What the line is called in its file',
  })
  readonly key: string;

  @ApiProperty({ example: 'Default' })
  readonly name: string;

  @ApiProperty({ type: StationResponseDto, isArray: true })
  readonly stations: StationResponseDto[];

  @ApiProperty({ type: ReactionResponseDto, isArray: true })
  readonly reactions: ReactionResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['usespotlightai/spotlight'],
    description: 'The repositories a run on this line works in, as owner/name',
  })
  readonly repositories: string[];

  @ApiProperty({
    type: LineSourceResponseDto,
    nullable: true,
    description:
      'Where the line’s Terraform lives, which Spotlight opens pull requests against when a person picks a better station config. Null when the line does not say.',
  })
  readonly source: LineSourceResponseDto | null;

  @ApiProperty({
    type: LineReplayCheckResponseDto,
    nullable: true,
    description:
      'The threshold planned changes of the line’s stations are checked against, set through Terraform; null when the line checks none',
  })
  readonly replayCheck: LineReplayCheckResponseDto | null;

  constructor(
    id: string,
    key: string,
    name: string,
    stations: StationResponseDto[],
    reactions: ReactionResponseDto[],
    repositories: string[],
    source: LineSourceSummary | null,
    replayCheck: LineReplayCheckSummary | null,
  ) {
    this.id = id;
    this.key = key;
    this.name = name;
    this.stations = stations;
    this.reactions = reactions;
    this.repositories = repositories;
    this.source = source ? new LineSourceResponseDto(source) : null;
    this.replayCheck = replayCheck
      ? new LineReplayCheckResponseDto(replayCheck)
      : null;
  }
}

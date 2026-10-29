import { ApiProperty } from '@nestjs/swagger';
import {
  REPOSITORY_HOSTS,
  type RepositoryHost,
} from '@shared-kernel/domain/value-objects/repository.vo';
import type {
  LineReplayCheckSummary,
  LineSearchSummary,
  LineSourceSummary,
  RepositorySummary,
  SearchPolicySummary,
  StationAlertSummary,
  StationJudgeSummary,
} from '@work/application/ports/line-reader.port';
import { EFFORTS } from '@work/domain/value-objects/effort.vo';
import { SEARCH_OBJECTIVES } from '@work/domain/value-objects/search-policy.vo';
import { ALERT_MEASURES } from '@work/domain/value-objects/station-alert.vo';

export class StationJudgeResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'A good run changes only what the task requests.',
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
  readonly passThreshold: number;

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
  readonly minAgreement: number;

  constructor(judge: StationJudgeSummary) {
    this.rubric = judge.rubric;
    this.claims = [...judge.claims];
    this.passThreshold = judge.passThreshold;
    this.sample = judge.sample;
    this.minAgreement = judge.minAgreement;
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

export class LineSearchResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether Spotlight searches for better station configs on its own',
  })
  readonly enabled: boolean;

  @ApiProperty({
    example: 50,
    description:
      'The most all automatic searches of the line may spend in one calendar month',
  })
  readonly monthlyCeiling: number;

  @ApiProperty({
    example: 'USD',
    description: 'The currency of the ceilings',
  })
  readonly currency: string;

  @ApiProperty({
    example: 10,
    description: 'The most one automatic search may spend',
  })
  readonly ceiling: number;

  @ApiProperty({
    example: '7d',
    description:
      'The longest time between two scheduled searches of a station, as in 12h or 7d',
  })
  readonly period: string;

  @ApiProperty({
    example: true,
    description: 'Whether an alert that goes off on a station starts a search',
  })
  readonly onAlert: boolean;

  @ApiProperty({
    example: '3d',
    description:
      'The shortest time between two automatic searches of a station, as in 12h or 3d',
  })
  readonly cooldown: string;

  constructor(policy: LineSearchSummary) {
    this.enabled = policy.enabled;
    this.monthlyCeiling = policy.monthlyCeiling;
    this.currency = policy.currency;
    this.ceiling = policy.ceiling;
    this.period = policy.period;
    this.onAlert = policy.onAlert;
    this.cooldown = policy.cooldown;
  }
}

export class StationSearchAgentResponseDto {
  @ApiProperty({
    example: 'claude-code',
    description: 'The harness that proposes candidate configs',
  })
  readonly harness: string;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description: 'The model the harness uses. Null leaves its default.',
  })
  readonly model: string | null;

  @ApiProperty({
    enum: [...EFFORTS, null],
    example: 'high',
    nullable: true,
    description: 'How hard the agent thinks. Null leaves its default.',
  })
  readonly effort: string | null;

  constructor(agent: NonNullable<SearchPolicySummary['agent']>) {
    this.harness = agent.harness;
    this.model = agent.model;
    this.effort = agent.effort;
  }
}

export class StationSearchResponseDto extends LineSearchResponseDto {
  @ApiProperty({
    type: StationSearchAgentResponseDto,
    nullable: true,
    description:
      'The agent that proposes candidates. Null when Spotlight picks one.',
  })
  readonly agent: StationSearchAgentResponseDto | null;

  @ApiProperty({
    example: 3,
    nullable: true,
    type: Number,
    description:
      'How many iterations one search runs. Null when Spotlight picks.',
  })
  readonly iterations: number | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: Number,
    description:
      'How many times each task is replayed. Null when Spotlight picks.',
  })
  readonly repeats: number | null;

  @ApiProperty({
    enum: [...SEARCH_OBJECTIVES, null],
    example: null,
    nullable: true,
    description:
      'What a search improves: success or cost. Null when the station’s health decides.',
  })
  readonly objective: string | null;

  constructor(policy: SearchPolicySummary) {
    super(policy);
    this.agent = policy.agent
      ? new StationSearchAgentResponseDto(policy.agent)
      : null;
    this.iterations = policy.iterations;
    this.repeats = policy.repeats;
    this.objective = policy.objective;
  }
}

export class StationResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly id: string;

  @ApiProperty({
    example: 'triage',
    description:
      'What the station is called in its line definition, and what a run passes a task to it by',
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
      'How hard the harness must think. Null leaves its own default.',
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
    type: StationSearchResponseDto,
    nullable: true,
    description:
      'How Spotlight searches for better configs of the station on its own: the line’s search with the station’s own search over it. Null for a backlog or the completed station.',
  })
  readonly search: StationSearchResponseDto | null;

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
    description: 'The team’s own skills enabled for a run here',
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
    search: SearchPolicySummary | null,
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
    this.search = search ? new StationSearchResponseDto(search) : null;
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

export class LineRepositoryResponseDto {
  @ApiProperty({
    example: 'usespotlightai/spotlight',
    description: 'The repository, as owner/name',
  })
  readonly fullName: string;

  @ApiProperty({
    enum: REPOSITORY_HOSTS,
    example: 'github',
    description: 'Where the repository is hosted',
  })
  readonly host: RepositoryHost;

  @ApiProperty({
    example: 'https://github.com/usespotlightai/spotlight',
    description: 'The repository on its host',
  })
  readonly url: string;

  constructor(repository: RepositorySummary) {
    this.fullName = repository.fullName;
    this.host = repository.host;
    this.url = repository.url;
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
    type: LineRepositoryResponseDto,
    isArray: true,
    description: 'The repositories a run on this line works in',
  })
  readonly repositories: LineRepositoryResponseDto[];

  @ApiProperty({
    type: LineSourceResponseDto,
    nullable: true,
    description:
      'Where the line’s Terraform lives, which Spotlight opens config pull requests against when a search finds a better station config. Null when the line does not say.',
  })
  readonly source: LineSourceResponseDto | null;

  @ApiProperty({
    type: LineReplayCheckResponseDto,
    nullable: true,
    description:
      'The threshold planned changes of the line’s stations are checked against, set through Terraform; null when the line checks none',
  })
  readonly replayCheck: LineReplayCheckResponseDto | null;

  @ApiProperty({
    type: LineSearchResponseDto,
    description:
      'How Spotlight searches for better station configs on its own, set through Terraform. A station’s own search changes it for that station.',
  })
  readonly search: LineSearchResponseDto;

  constructor(
    id: string,
    key: string,
    name: string,
    stations: StationResponseDto[],
    reactions: ReactionResponseDto[],
    repositories: readonly RepositorySummary[],
    source: LineSourceSummary | null,
    replayCheck: LineReplayCheckSummary | null,
    search: LineSearchSummary,
  ) {
    this.id = id;
    this.key = key;
    this.name = name;
    this.stations = stations;
    this.reactions = reactions;
    this.repositories = repositories.map(
      (each) => new LineRepositoryResponseDto(each),
    );
    this.source = source ? new LineSourceResponseDto(source) : null;
    this.replayCheck = replayCheck
      ? new LineReplayCheckResponseDto(replayCheck)
      : null;
    this.search = new LineSearchResponseDto(search);
  }
}

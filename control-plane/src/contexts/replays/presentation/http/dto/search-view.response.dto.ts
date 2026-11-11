import { ApiProperty } from '@nestjs/swagger';
import type {
  SearchViewCandidateDto,
  SearchViewDto,
  SearchViewRunDto,
} from '@replays/application/dto/search-view.dto';
import type { HistoryRunUsage } from '@replays/application/ports/station-history.port';
import type { VisibleBlock } from '@replays/application/queries/search-visibilities';

const BLOCK_EXAMPLE = {
  key: 'build',
  name: 'Build',
  kind: 'work',
  harness: 'claude-code',
  prompt: 'Build it, then drain the queue.',
  passesTo: ['ship'],
};

export class SearchViewUsageResponseDto {
  @ApiProperty({ nullable: true, type: Number })
  readonly ms: number | null;

  @ApiProperty()
  readonly steps: number;

  @ApiProperty()
  readonly errors: number;

  @ApiProperty({ nullable: true, type: Number })
  readonly contextTokens: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly cost: number | null;

  @ApiProperty({ nullable: true, type: String })
  readonly currency: string | null;

  constructor(from: HistoryRunUsage) {
    this.ms = from.ms;
    this.steps = from.steps;
    this.errors = from.errors;
    this.contextTokens = from.contextTokens;
    this.cost = from.cost;
    this.currency = from.currency;
  }
}

export class SearchViewRunResponseDto {
  @ApiProperty({ description: 'The replay run of the candidate' })
  readonly runId: string;

  @ApiProperty({ description: 'The task run it replayed' })
  readonly original: string;

  @ApiProperty({
    example: 1,
    description: 'Which copy of the task run it is, from 1',
  })
  readonly repeat: number;

  @ApiProperty()
  readonly taskId: string;

  @ApiProperty()
  readonly title: string;

  @ApiProperty({ nullable: true, type: String })
  readonly fingerprint: string | null;

  @ApiProperty({ example: 'completed' })
  readonly state: string;

  @ApiProperty()
  readonly attempt: number;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty()
  readonly startedAt: string;

  @ApiProperty()
  readonly endedAt: string;

  @ApiProperty({
    nullable: true,
    type: () => SearchViewUsageResponseDto,
    description:
      'What the replay cost; a replay run has no outcome of its own, so the response shows its cost beside the run',
  })
  readonly usage: SearchViewUsageResponseDto | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'The files the run changed, as the history of the station lists them',
  })
  readonly changes: readonly unknown[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The trace of the run, as the history of the station shows it',
  })
  readonly trace: unknown;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description: 'Whether the replay succeeded; null while it is unscored',
  })
  readonly succeeded: boolean | null;

  @ApiProperty({ type: [String] })
  readonly reasons: string[];

  @ApiProperty({ nullable: true, type: String, example: 'pass' })
  readonly verdict: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'What the judge says a failing replay should do differently, never its reasons',
    example: 'Give up on an upload that keeps failing instead of looping.',
  })
  readonly guidance: string | null;

  constructor(from: SearchViewRunDto) {
    this.runId = from.runId;
    this.original = from.original;
    this.repeat = from.repeat;
    this.taskId = from.taskId;
    this.title = from.title;
    this.fingerprint = from.fingerprint;
    this.state = from.state;
    this.attempt = from.attempt;
    this.harness = from.harness;
    this.startedAt = from.startedAt;
    this.endedAt = from.endedAt;
    this.usage = from.usage ? new SearchViewUsageResponseDto(from.usage) : null;
    this.changes = from.changes;
    this.trace = from.trace;
    this.succeeded = from.succeeded;
    this.reasons = [...from.reasons];
    this.verdict = from.verdict;
    this.guidance = from.guidance;
  }
}

export class SearchViewCandidateResponseDto {
  @ApiProperty({ example: 'oldest-first' })
  readonly candidateName: string;

  @ApiProperty({ description: 'The SHA-256 naming the candidate’s config' })
  readonly fingerprint: string;

  @ApiProperty({ description: 'Why the search proposed the candidate' })
  readonly hypothesis: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The candidate’s station block, in the shape that the line resource uses for a station',
    example: BLOCK_EXAMPLE,
  })
  readonly block: VisibleBlock;

  @ApiProperty({ type: () => [SearchViewRunResponseDto] })
  readonly runs: SearchViewRunResponseDto[];

  constructor(from: SearchViewCandidateDto) {
    this.candidateName = from.candidateName;
    this.fingerprint = from.fingerprint;
    this.hypothesis = from.hypothesis;
    this.block = from.block;
    this.runs = from.runs.map((each) => new SearchViewRunResponseDto(each));
  }
}

export class SearchViewConfigResponseDto {
  @ApiProperty({ description: 'The SHA-256 naming this station config' })
  readonly fingerprint: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The station config, in the shape the station history uses for a config',
  })
  readonly config: unknown;

  constructor(from: SearchViewDto['configs'][number]) {
    this.fingerprint = from.fingerprint;
    this.config = from.config;
  }
}

export class SearchViewResponseDto {
  @ApiProperty({
    type: () => [SearchViewConfigResponseDto],
    description:
      'The station configs of the candidates and their replay runs, for the configs the history does not list',
  })
  readonly configs: SearchViewConfigResponseDto[];

  @ApiProperty({
    type: () => [SearchViewCandidateResponseDto],
    description: 'The candidates the search proposed and their replay runs',
  })
  readonly candidates: SearchViewCandidateResponseDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'The station block the search started from',
    example: BLOCK_EXAMPLE,
  })
  readonly seedBlock: VisibleBlock | null;

  constructor(from: SearchViewDto) {
    this.configs = from.configs.map(
      (each) => new SearchViewConfigResponseDto(each),
    );
    this.candidates = from.candidates.map(
      (each) => new SearchViewCandidateResponseDto(each),
    );
    this.seedBlock = from.seedBlock;
  }
}

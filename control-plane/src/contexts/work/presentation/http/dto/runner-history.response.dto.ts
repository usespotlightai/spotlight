import { ApiProperty } from '@nestjs/swagger';
import type {
  HistoryCandidateDto,
  HistoryCandidateRunDto,
  HistoryOutcome,
  HistoryRunDto,
  HistoryUsage,
  RunnerHistoryDto,
} from '@work/application/dto/runner-history.dto';
import type { VisibleBlock } from '@work/application/ports/search-visibility.port';
import type { FileChange } from '@work/application/read-models/file-changes-of';
import { StationConfigResponseDto } from '@work/presentation/http/dto/station-config.response.dto';
import { TaskTraceResponseDto } from '@work/presentation/http/dto/task-trace.response.dto';

export class HistoryPlaceResponseDto {
  @ApiProperty({ example: 'implementation' })
  readonly key: string;

  @ApiProperty({ example: 'Implementation' })
  readonly name: string;

  constructor(from: { key: string; name: string }) {
    this.key = from.key;
    this.name = from.name;
  }
}

export class HistoryConfigResponseDto {
  @ApiProperty({ description: 'The SHA-256 naming this station config' })
  readonly fingerprint: string;

  @ApiProperty({ type: () => StationConfigResponseDto })
  readonly config: StationConfigResponseDto;

  constructor(from: RunnerHistoryDto['configs'][number]) {
    this.fingerprint = from.fingerprint;
    this.config = new StationConfigResponseDto(from.config);
  }
}

export class RunUsageResponseDto {
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

  constructor(from: HistoryUsage) {
    this.ms = from.ms;
    this.steps = from.steps;
    this.errors = from.errors;
    this.contextTokens = from.contextTokens;
    this.cost = from.cost;
    this.currency = from.currency;
  }
}

export class TaskHumanActionResponseDto {
  @ApiProperty({
    enum: [
      'started',
      'parked',
      'accepted',
      'answered',
      'approved',
      'dismissed',
      'sent-back',
    ],
  })
  readonly kind: string;

  @ApiProperty()
  readonly at: string;

  constructor(from: { kind: string; at: string }) {
    this.kind = from.kind;
    this.at = from.at;
  }
}

export class RunOutcomeResponseDto {
  @ApiProperty({
    enum: [
      'completed',
      'failed',
      'stopped',
      'exhausted',
      'cancelled',
      'superseded',
    ],
  })
  readonly ending: string;

  @ApiProperty({ nullable: true, type: String, example: 'exited' })
  readonly failure: string | null;

  @ApiProperty({
    description:
      'How many runs this station has taken on the task, this one included',
  })
  readonly visit: number;

  @ApiProperty({ nullable: true, type: () => RunUsageResponseDto })
  readonly usage: RunUsageResponseDto | null;

  @ApiProperty({
    nullable: true,
    enum: ['passed', 'failed', 'skipped', null],
  })
  readonly checks: string | null;

  @ApiProperty({ nullable: true, type: () => TaskHumanActionResponseDto })
  readonly firstHumanAction: TaskHumanActionResponseDto | null;

  @ApiProperty({
    nullable: true,
    enum: ['open', 'merged', 'closed', null],
  })
  readonly pullRequestState: string | null;

  constructor(from: HistoryOutcome) {
    this.ending = from.ending;
    this.failure = from.failure;
    this.visit = from.visit;
    this.usage = from.usage ? new RunUsageResponseDto(from.usage) : null;
    this.checks = from.checks;
    this.firstHumanAction = from.firstHumanAction
      ? new TaskHumanActionResponseDto(from.firstHumanAction)
      : null;
    this.pullRequestState = from.pullRequestState;
  }
}

export class FileChangeResponseDto {
  @ApiProperty({ example: 'src/queue.ts' })
  readonly path: string;

  @ApiProperty()
  readonly before: string;

  @ApiProperty()
  readonly after: string;

  @ApiProperty({
    description:
      'The file was too large to send whole; before and after are empty',
  })
  readonly omitted: boolean;

  constructor(from: FileChange) {
    this.path = from.path;
    this.before = from.before;
    this.after = from.after;
    this.omitted = from.omitted;
  }
}

export class HistoryRunResponseDto {
  @ApiProperty()
  readonly runId: string;

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

  @ApiProperty({ nullable: true, type: () => RunOutcomeResponseDto })
  readonly outcome: RunOutcomeResponseDto | null;

  @ApiProperty({ type: () => [FileChangeResponseDto] })
  readonly changes: FileChangeResponseDto[];

  @ApiProperty({ type: () => TaskTraceResponseDto })
  readonly trace: TaskTraceResponseDto;

  constructor(from: HistoryRunDto, trace: TaskTraceResponseDto) {
    this.runId = from.runId;
    this.taskId = from.taskId;
    this.title = from.title;
    this.fingerprint = from.fingerprint;
    this.state = from.state;
    this.attempt = from.attempt;
    this.harness = from.harness;
    this.startedAt = from.startedAt;
    this.endedAt = from.endedAt;
    this.outcome = from.outcome
      ? new RunOutcomeResponseDto(from.outcome)
      : null;
    this.changes = from.changes.map((each) => new FileChangeResponseDto(each));
    this.trace = trace;
  }
}

export class HistoryCandidateRunResponseDto {
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
    type: () => RunUsageResponseDto,
    description:
      'What the replay cost; a replay run has no outcome of its own, so the response shows its cost beside the run',
  })
  readonly usage: RunUsageResponseDto | null;

  @ApiProperty({ type: () => [FileChangeResponseDto] })
  readonly changes: FileChangeResponseDto[];

  @ApiProperty({ type: () => TaskTraceResponseDto })
  readonly trace: TaskTraceResponseDto;

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

  constructor(from: HistoryCandidateRunDto, trace: TaskTraceResponseDto) {
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
    this.usage = from.usage ? new RunUsageResponseDto(from.usage) : null;
    this.changes = from.changes.map((each) => new FileChangeResponseDto(each));
    this.trace = trace;
    this.succeeded = from.succeeded;
    this.reasons = [...from.reasons];
    this.verdict = from.verdict;
    this.guidance = from.guidance;
  }
}

export class HistoryCandidateResponseDto {
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
    example: {
      key: 'build',
      name: 'Build',
      kind: 'work',
      harness: 'claude-code',
      prompt: 'Build it, then drain the queue.',
      passesTo: ['ship'],
    },
  })
  readonly block: VisibleBlock;

  @ApiProperty({ type: () => [HistoryCandidateRunResponseDto] })
  readonly runs: HistoryCandidateRunResponseDto[];

  constructor(
    from: HistoryCandidateDto,
    runs: HistoryCandidateRunResponseDto[],
  ) {
    this.candidateName = from.candidateName;
    this.fingerprint = from.fingerprint;
    this.hypothesis = from.hypothesis;
    this.block = from.block;
    this.runs = runs;
  }
}

export class RunnerHistoryResponseDto {
  @ApiProperty({ type: () => HistoryPlaceResponseDto })
  readonly line: HistoryPlaceResponseDto;

  @ApiProperty({ type: () => HistoryPlaceResponseDto })
  readonly station: HistoryPlaceResponseDto;

  @ApiProperty({ type: () => [HistoryConfigResponseDto] })
  readonly configs: HistoryConfigResponseDto[];

  @ApiProperty({ type: () => [HistoryRunResponseDto] })
  readonly runs: HistoryRunResponseDto[];

  @ApiProperty({
    type: () => [HistoryCandidateResponseDto],
    description:
      'For a search run, the candidates it proposed and their replay runs; empty for any other run',
  })
  readonly candidates: HistoryCandidateResponseDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'For a search run, the station block it started from; null for any other run',
    example: {
      key: 'build',
      name: 'Build',
      kind: 'work',
      harness: 'claude-code',
      prompt: 'Build it, then drain the queue.',
      passesTo: ['ship'],
    },
  })
  readonly seedBlock: VisibleBlock | null;

  constructor(
    from: RunnerHistoryDto,
    runs: HistoryRunResponseDto[],
    candidates: HistoryCandidateResponseDto[],
  ) {
    this.line = new HistoryPlaceResponseDto(from.line);
    this.station = new HistoryPlaceResponseDto(from.station);
    this.configs = from.configs.map(
      (each) => new HistoryConfigResponseDto(each),
    );
    this.runs = runs;
    this.candidates = candidates;
    this.seedBlock = from.seedBlock;
  }
}

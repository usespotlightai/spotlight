import { ApiProperty } from '@nestjs/swagger';
import type {
  HistoryOutcome,
  HistoryRunDto,
  HistoryUsage,
  RunnerHistoryDto,
} from '@work/application/dto/runner-history.dto';
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

export class RunnerHistoryResponseDto {
  @ApiProperty({ type: () => HistoryPlaceResponseDto })
  readonly line: HistoryPlaceResponseDto;

  @ApiProperty({ type: () => HistoryPlaceResponseDto })
  readonly station: HistoryPlaceResponseDto;

  @ApiProperty({ type: () => [HistoryConfigResponseDto] })
  readonly configs: HistoryConfigResponseDto[];

  @ApiProperty({ type: () => [HistoryRunResponseDto] })
  readonly runs: HistoryRunResponseDto[];

  constructor(from: RunnerHistoryDto, runs: HistoryRunResponseDto[]) {
    this.line = new HistoryPlaceResponseDto(from.line);
    this.station = new HistoryPlaceResponseDto(from.station);
    this.configs = from.configs.map(
      (each) => new HistoryConfigResponseDto(each),
    );
    this.runs = runs;
  }
}

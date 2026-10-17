import { ApiProperty } from '@nestjs/swagger';
import type {
  HistoryCandidateDto,
  HistoryCandidateRunDto,
  HistoryCost,
  HistoryOutcome,
  HistoryRunDto,
  RunnerHistoryDto,
} from '@work/application/dto/runner-history.dto';
import type { SightedBlock } from '@work/application/ports/search-sight.port';
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

export class RunCostResponseDto {
  @ApiProperty({ nullable: true, type: Number })
  readonly ms: number | null;

  @ApiProperty()
  readonly steps: number;

  @ApiProperty()
  readonly faults: number;

  @ApiProperty({ nullable: true, type: Number })
  readonly used: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly cost: number | null;

  @ApiProperty({ nullable: true, type: String })
  readonly currency: string | null;

  constructor(from: HistoryCost) {
    this.ms = from.ms;
    this.steps = from.steps;
    this.faults = from.faults;
    this.used = from.used;
    this.cost = from.cost;
    this.currency = from.currency;
  }
}

export class PersonActResponseDto {
  @ApiProperty({
    enum: [
      'started',
      'parked',
      'closed',
      'answered',
      'approved',
      'refused',
      'sent-back',
    ],
  })
  readonly act: string;

  @ApiProperty()
  readonly at: string;

  constructor(from: { act: string; at: string }) {
    this.act = from.act;
    this.at = from.at;
  }
}

export class RunTurnedOutResponseDto {
  @ApiProperty({
    enum: [
      'completed',
      'failed',
      'stopped',
      'abandoned',
      'withdrawn',
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
  readonly round: number;

  @ApiProperty({ nullable: true, type: () => RunCostResponseDto })
  readonly cost: RunCostResponseDto | null;

  @ApiProperty({
    nullable: true,
    enum: ['passed', 'failed', 'skipped', null],
  })
  readonly checks: string | null;

  @ApiProperty({ nullable: true, type: () => PersonActResponseDto })
  readonly next: PersonActResponseDto | null;

  @ApiProperty({
    nullable: true,
    enum: ['open', 'merged', 'closed', null],
  })
  readonly delivery: string | null;

  constructor(from: HistoryOutcome) {
    this.ending = from.ending;
    this.failure = from.failure;
    this.round = from.round;
    this.cost = from.cost ? new RunCostResponseDto(from.cost) : null;
    this.checks = from.checks;
    this.next = from.next ? new PersonActResponseDto(from.next) : null;
    this.delivery = from.delivery;
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

  @ApiProperty({ nullable: true, type: () => RunTurnedOutResponseDto })
  readonly outcome: RunTurnedOutResponseDto | null;

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
      ? new RunTurnedOutResponseDto(from.outcome)
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
    type: () => RunCostResponseDto,
    description:
      'What the replay cost; a replay run has no outcome of its own, so its cost stands beside the run',
  })
  readonly cost: RunCostResponseDto | null;

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
    this.cost = from.cost ? new RunCostResponseDto(from.cost) : null;
    this.changes = from.changes.map((each) => new FileChangeResponseDto(each));
    this.trace = trace;
    this.succeeded = from.succeeded;
    this.reasons = [...from.reasons];
    this.verdict = from.verdict;
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
  readonly block: SightedBlock;

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
  readonly seedBlock: SightedBlock | null;

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

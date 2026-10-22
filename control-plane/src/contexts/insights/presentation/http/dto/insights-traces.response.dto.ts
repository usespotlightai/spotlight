import type {
  InsightsTraceDto,
  InsightsTracesDto,
  TraceRunDto,
  TraceStationDto,
  TraceVolumeBucketDto,
} from '@insights/application/dto/insights-traces.dto';
import { RUN_ENDINGS } from '@insights/domain/value-objects/run-ending';
import { RUN_PROGRESSES } from '@insights/domain/value-objects/run-progress';
import { TRACE_RANGES } from '@insights/domain/value-objects/trace-range.vo';
import { PersonNameResponseDto } from '@insights/presentation/http/dto/insights-common.response.dto';
import { MoneyResponseDto } from '@insights/presentation/http/dto/station-insights.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class TraceStationResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ example: 'Implementation' })
  readonly name: string;

  @ApiProperty({ example: '#edc12b' })
  readonly color: string;

  @ApiProperty({ example: 1 })
  readonly position: number;

  @ApiProperty({ example: 3, description: 'How many stations the line has' })
  readonly count: number;

  constructor(station: TraceStationDto) {
    this.stationId = station.stationId;
    this.name = station.name;
    this.color = station.color;
    this.position = station.position;
    this.count = station.count;
  }
}

export class TraceRunResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly runId: string;

  @ApiProperty({ type: TraceStationResponseDto, nullable: true })
  readonly station: TraceStationResponseDto | null;

  @ApiProperty({
    enum: [...RUN_PROGRESSES, null],
    nullable: true,
    description: 'None when the run ended',
  })
  readonly progress: string | null;

  @ApiProperty({
    enum: [...RUN_ENDINGS, null],
    nullable: true,
    description: 'None until the run ends',
  })
  readonly ending: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'exited' })
  readonly failure: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'user_ada',
    description:
      'Who opened the run’s task; none where no person did; their name is in people',
  })
  readonly openedBy: string | null;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'claude-sonnet-4',
    description:
      'None until a runner claims it, or where the harness chose its own',
  })
  readonly model: string | null;

  @ApiProperty({
    example: '2026-09-30T10:00:00.000Z',
    description: 'When a runner claimed it, or when it was queued',
  })
  readonly startedAt: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'None until it ends',
  })
  readonly endedAt: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 143000 })
  readonly ms: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 2,
    description: 'None until its usage is recorded',
  })
  readonly errors: number | null;

  @ApiProperty({ type: MoneyResponseDto, nullable: true })
  readonly cost: MoneyResponseDto | null;

  constructor(run: TraceRunDto) {
    this.runId = run.runId;
    this.station = run.station && new TraceStationResponseDto(run.station);
    this.progress = run.progress;
    this.ending = run.ending;
    this.failure = run.failure;
    this.openedBy = run.openedBy;
    this.harness = run.harness;
    this.model = run.model;
    this.startedAt = run.startedAt;
    this.endedAt = run.endedAt;
    this.ms = run.ms;
    this.errors = run.errors;
    this.cost = run.cost ? new MoneyResponseDto(run.cost) : null;
  }
}

export class InsightsTraceResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the task asks for',
  })
  readonly input: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The last note that the newest listed run wrote on the task',
  })
  readonly output: string | null;

  @ApiProperty({
    type: TraceStationResponseDto,
    nullable: true,
    description: 'Where the task is now',
  })
  readonly station: TraceStationResponseDto | null;

  @ApiProperty({
    type: TraceStationResponseDto,
    isArray: true,
    description:
      'Every station of the listed runs, and where the task is now, in the line’s order',
  })
  readonly stations: readonly TraceStationResponseDto[];

  @ApiProperty({ example: '2026-08-29T12:00:00.000Z' })
  readonly startedAt: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 143000,
    description:
      'From the first listed run’s start to the last one’s end; none while a run is unfinished',
  })
  readonly ms: number | null;

  @ApiProperty({ example: 2 })
  readonly errors: number;

  @ApiProperty({
    type: MoneyResponseDto,
    nullable: true,
    description:
      'None where no listed run is priced, or where prices are in more than one currency',
  })
  readonly cost: MoneyResponseDto | null;

  @ApiProperty({
    example: 5,
    description:
      'How many runs the task had in the range, the filter not applied',
  })
  readonly total: number;

  @ApiProperty({
    type: TraceRunResponseDto,
    isArray: true,
    description:
      'The task’s runs that match the filter: unfinished first, then the newest first',
  })
  readonly runs: readonly TraceRunResponseDto[];

  constructor(trace: InsightsTraceDto) {
    this.taskId = trace.taskId;
    this.title = trace.title;
    this.input = trace.input;
    this.output = trace.output;
    this.station = trace.station && new TraceStationResponseDto(trace.station);
    this.stations = trace.stations.map(
      (each) => new TraceStationResponseDto(each),
    );
    this.startedAt = trace.startedAt;
    this.ms = trace.ms;
    this.errors = trace.errors;
    this.cost = trace.cost ? new MoneyResponseDto(trace.cost) : null;
    this.total = trace.total;
    this.runs = trace.runs.map((each) => new TraceRunResponseDto(each));
  }
}

export class TraceVolumeBucketResponseDto {
  @ApiProperty({
    example: '2026-08-29T12:00:00.000Z',
    description: 'When the bar starts',
  })
  readonly from: string;

  @ApiProperty({
    example: '2026-08-29T13:00:00.000Z',
    description: 'When the bar ends, not included',
  })
  readonly to: string;

  @ApiProperty({
    example: 4,
    description: 'How many traces had their latest run in it',
  })
  readonly count: number;

  @ApiProperty({ example: 1, description: 'Every error in those traces' })
  readonly errors: number;

  constructor(bucket: TraceVolumeBucketDto) {
    this.from = bucket.from;
    this.to = bucket.to;
    this.count = bucket.count;
    this.errors = bucket.errors;
  }
}

export class InsightsTracesResponseDto {
  @ApiProperty({ example: '7d', enum: TRACE_RANGES })
  readonly range: string;

  @ApiProperty({
    example: '2026-08-22T12:00:00.000Z',
    description: 'Where the range starts',
  })
  readonly from: string;

  @ApiProperty({
    example: '2026-08-29T12:00:00.000Z',
    description: 'Where the range ends: when it was requested',
  })
  readonly to: string;

  @ApiProperty({
    type: TraceVolumeBucketResponseDto,
    isArray: true,
    description:
      'Every trace in the range, counted into evenly long bars from start to end, empty bars included',
  })
  readonly volume: readonly TraceVolumeBucketResponseDto[];

  @ApiProperty({
    type: InsightsTraceResponseDto,
    isArray: true,
    description:
      'Every task with a run that matches the filter: one that is unfinished, or one that ended in the range. Unfinished first, then the latest first',
  })
  readonly traces: readonly InsightsTraceResponseDto[];

  @ApiProperty({
    example: 64,
    description:
      'How many runs match the filter: those that ended in the range, and those that are unfinished',
  })
  readonly matched: number;

  @ApiProperty({
    example: false,
    description: 'true when more runs match than the list holds',
  })
  readonly truncated: boolean;

  @ApiProperty({ type: PersonNameResponseDto, isArray: true })
  readonly people: readonly PersonNameResponseDto[];

  constructor(traces: InsightsTracesDto) {
    this.range = traces.range;
    this.from = traces.from;
    this.to = traces.to;
    this.volume = traces.volume.map(
      (each) => new TraceVolumeBucketResponseDto(each),
    );
    this.traces = traces.traces.map(
      (each) => new InsightsTraceResponseDto(each),
    );
    this.matched = traces.matched;
    this.truncated = traces.truncated;
    this.people = traces.people.map((each) => new PersonNameResponseDto(each));
  }
}

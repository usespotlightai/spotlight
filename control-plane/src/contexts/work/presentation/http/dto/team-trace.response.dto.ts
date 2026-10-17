import { ApiProperty } from '@nestjs/swagger';
import { RUN_STATE_NAMES } from '@work/application/dto/task-run.dto';
import { TRACE_RANGES } from '@work/domain/value-objects/trace-range.vo';

export class TraceStationResponseDto {
  @ApiProperty({ example: 'Implementation' })
  readonly name: string;

  @ApiProperty({ example: '#edc12b' })
  readonly color: string;

  @ApiProperty({ example: 1 })
  readonly position: number;

  @ApiProperty({ example: 3, description: 'How many stations the line has' })
  readonly count: number;

  constructor(name: string, color: string, position: number, count: number) {
    this.name = name;
    this.color = color;
    this.position = position;
    this.count = count;
  }
}

export class TeamTraceResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({ type: TraceStationResponseDto, nullable: true })
  readonly station: TraceStationResponseDto | null;

  @ApiProperty({
    type: TraceStationResponseDto,
    isArray: true,
    description: 'Every station that has worked it, in the line’s own order',
  })
  readonly stations: readonly TraceStationResponseDto[];

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ example: 'completed', enum: RUN_STATE_NAMES })
  readonly state: string;

  @ApiProperty({ example: '2026-08-29T12:00:00.000Z' })
  readonly startedAt: string;

  @ApiProperty({ example: 3, description: 'How many runs worked the task' })
  readonly runs: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the last run was put to',
  })
  readonly input: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The last note that the run wrote on the task',
  })
  readonly output: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 143000 })
  readonly ms: number | null;

  @ApiProperty({ example: 128 })
  readonly steps: number;

  @ApiProperty({ example: 2 })
  readonly faults: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.4213 })
  readonly cost: number | null;

  @ApiProperty({ nullable: true, type: String, example: 'USD' })
  readonly currency: string | null;

  constructor(
    taskId: string,
    title: string,
    station: TraceStationResponseDto | null,
    stations: readonly TraceStationResponseDto[],
    harness: string,
    state: string,
    startedAt: string,
    runs: number,
    input: string | null,
    output: string | null,
    ms: number | null,
    steps: number,
    faults: number,
    cost: number | null,
    currency: string | null,
  ) {
    this.taskId = taskId;
    this.title = title;
    this.station = station;
    this.stations = stations;
    this.harness = harness;
    this.state = state;
    this.startedAt = startedAt;
    this.runs = runs;
    this.input = input;
    this.output = output;
    this.ms = ms;
    this.steps = steps;
    this.faults = faults;
    this.cost = cost;
    this.currency = currency;
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

  @ApiProperty({ example: 4, description: 'How many traces started in it' })
  readonly count: number;

  @ApiProperty({
    example: 1,
    description: 'Every fault the traces that started in it came to',
  })
  readonly faults: number;

  constructor(from: string, to: string, count: number, faults: number) {
    this.from = from;
    this.to = to;
    this.count = count;
    this.faults = faults;
  }
}

export class TeamTracesResponseDto {
  @ApiProperty({ example: '7d', enum: TRACE_RANGES })
  readonly range: string;

  @ApiProperty({
    example: '2026-08-22T12:00:00.000Z',
    description: 'Where the range starts',
  })
  readonly from: string;

  @ApiProperty({
    example: '2026-08-29T12:00:00.000Z',
    description: 'Where the range ends: when it was asked',
  })
  readonly to: string;

  @ApiProperty({
    type: TraceVolumeBucketResponseDto,
    isArray: true,
    description:
      'Every trace in the range, counted into evenly long bars from start to end, empty bars kept',
  })
  readonly volume: readonly TraceVolumeBucketResponseDto[];

  @ApiProperty({
    type: TeamTraceResponseDto,
    isArray: true,
    description: 'Every trace in the range, latest first',
  })
  readonly traces: readonly TeamTraceResponseDto[];

  constructor(
    range: string,
    from: string,
    to: string,
    volume: readonly TraceVolumeBucketResponseDto[],
    traces: readonly TeamTraceResponseDto[],
  ) {
    this.range = range;
    this.from = from;
    this.to = to;
    this.volume = volume;
    this.traces = traces;
  }
}

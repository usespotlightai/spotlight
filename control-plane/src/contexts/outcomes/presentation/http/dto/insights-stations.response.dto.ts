import { ApiProperty } from '@nestjs/swagger';
import type {
  InsightsStationsDto,
  StationReportDto,
} from '@outcomes/application/dto/insights.dto';
import type {
  RunFailureSummary,
  TaskFailureSummary,
} from '@outcomes/domain/services/failure-summaries';
import type { DayTally } from '@outcomes/domain/services/station-reports';
import { InsightsPeriodResponseDto } from '@outcomes/presentation/http/dto/insights-common.response.dto';
import { RunTallyResponseDto } from '@outcomes/presentation/http/dto/station-outcomes.response.dto';

export class DayTallyResponseDto {
  @ApiProperty({ example: '2026-09-30', description: 'A UTC day' })
  readonly day: string;

  @ApiProperty({ type: RunTallyResponseDto })
  readonly tally: RunTallyResponseDto;

  constructor(day: DayTally) {
    this.day = day.day;
    this.tally = new RunTallyResponseDto(day.tally);
  }
}

export class TaskFailureSummaryResponseDto {
  @ApiProperty({
    example: 'hook:notify',
    description: 'run, or hook:<name> for a hook’s failure',
  })
  readonly source: string;

  @ApiProperty({ example: 'loop', description: 'What went wrong' })
  readonly code: string;

  @ApiProperty({
    example: 3,
    description: 'Times it was raised or repeated in the period',
  })
  readonly occurrences: number;

  @ApiProperty({
    example: 3,
    description: 'The most times it repeated on one task without a break',
  })
  readonly mostInARow: number;

  @ApiProperty({ type: String, isArray: true })
  readonly taskIds: readonly string[];

  constructor(summary: TaskFailureSummary) {
    this.source = summary.source;
    this.code = summary.code;
    this.occurrences = summary.occurrences;
    this.mostInARow = summary.mostInARow;
    this.taskIds = summary.taskIds;
  }
}

export class RunFailureSummaryResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'exited',
    description: 'Why the runs failed, where they said',
  })
  readonly failure: string | null;

  @ApiProperty({ example: 2 })
  readonly runs: number;

  @ApiProperty({ type: String, isArray: true })
  readonly runIds: readonly string[];

  constructor(summary: RunFailureSummary) {
    this.failure = summary.failure;
    this.runs = summary.runs;
    this.runIds = summary.runIds;
  }
}

export class StationReportResponseDto {
  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    type: RunTallyResponseDto,
    description:
      'How its runs went this period, counted the same way as on the Station page',
  })
  readonly tally: RunTallyResponseDto;

  @ApiProperty({
    type: RunTallyResponseDto,
    description: 'How its runs went the period before',
  })
  readonly before: RunTallyResponseDto;

  @ApiProperty({
    type: DayTallyResponseDto,
    isArray: true,
    description: 'The tally per UTC day, oldest first',
  })
  readonly trend: readonly DayTallyResponseDto[];

  @ApiProperty({
    type: TaskFailureSummaryResponseDto,
    isArray: true,
    description:
      'Failures raised on its tasks, by source and code, apart from how its runs ended; a looping hook the loop guard stopped shows only here',
  })
  readonly taskFailures: readonly TaskFailureSummaryResponseDto[];

  @ApiProperty({
    type: RunFailureSummaryResponseDto,
    isArray: true,
    description: 'Its runs that failed, by why',
  })
  readonly runFailures: readonly RunFailureSummaryResponseDto[];

  constructor(report: StationReportDto) {
    this.lineId = report.lineId;
    this.stationId = report.stationId;
    this.tally = new RunTallyResponseDto(report.tally);
    this.before = new RunTallyResponseDto(report.before);
    this.trend = report.trend.map((each) => new DayTallyResponseDto(each));
    this.taskFailures = report.taskFailures.map(
      (each) => new TaskFailureSummaryResponseDto(each),
    );
    this.runFailures = report.runFailures.map(
      (each) => new RunFailureSummaryResponseDto(each),
    );
  }
}

export class InsightsStationsResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    example: false,
    description:
      'Whether the team ran more than 20,000 runs over the period and the one before, so only the latest 20,000 were counted',
  })
  readonly truncated: boolean;

  @ApiProperty({ type: RunTallyResponseDto, description: 'The whole team' })
  readonly team: RunTallyResponseDto;

  @ApiProperty({
    type: RunTallyResponseDto,
    description: 'The whole team, the period before',
  })
  readonly teamBefore: RunTallyResponseDto;

  @ApiProperty({ type: StationReportResponseDto, isArray: true })
  readonly stations: readonly StationReportResponseDto[];

  constructor(stations: InsightsStationsDto) {
    this.period = new InsightsPeriodResponseDto(stations.period);
    this.truncated = stations.truncated;
    this.team = new RunTallyResponseDto(stations.team);
    this.teamBefore = new RunTallyResponseDto(stations.teamBefore);
    this.stations = stations.stations.map(
      (each) => new StationReportResponseDto(each),
    );
  }
}

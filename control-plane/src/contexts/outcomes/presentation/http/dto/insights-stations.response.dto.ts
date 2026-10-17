import { ApiProperty } from '@nestjs/swagger';
import type {
  InsightsStationsDto,
  StationReportDto,
  TallyChangesDto,
} from '@outcomes/application/dto/insights.dto';
import type {
  RunFailureSummary,
  TaskFailureSummary,
} from '@outcomes/domain/services/failure-summaries';
import type {
  TallyCounted,
  TallySeen,
} from '@outcomes/domain/services/run-tally';
import type { DayTally } from '@outcomes/domain/services/station-reports';
import {
  ChangeResponseDto,
  changeResponseOf,
  InsightsPeriodResponseDto,
} from '@outcomes/presentation/http/dto/insights-common.response.dto';
import { RunTallyResponseDto } from '@outcomes/presentation/http/dto/station-outcomes.response.dto';

export class TallyChangesResponseDto {
  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Runs against the period before',
  })
  readonly runs: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Failed runs against the period before',
  })
  readonly failed: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Accepted runs against the period before',
  })
  readonly accepted: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Runs sent back against the period before',
  })
  readonly sentBack: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'Merged tasks against the period before',
  })
  readonly merged: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description:
      'Cost against the period before, where both were in one currency',
  })
  readonly cost: ChangeResponseDto | null;

  @ApiProperty({
    type: ChangeResponseDto,
    nullable: true,
    description: 'The median run time against the period before',
  })
  readonly median: ChangeResponseDto | null;

  constructor(changes: TallyChangesDto) {
    this.runs = changeResponseOf(changes.runs);
    this.failed = changeResponseOf(changes.failed);
    this.accepted = changeResponseOf(changes.accepted);
    this.sentBack = changeResponseOf(changes.sentBack);
    this.merged = changeResponseOf(changes.merged);
    this.cost = changeResponseOf(changes.cost);
    this.median = changeResponseOf(changes.median);
  }
}

export class TallySeenResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether any run was accepted this period or the period before',
  })
  readonly accepted: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether any run was sent back this period or the period before',
  })
  readonly sentBack: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether any task merged this period or the period before',
  })
  readonly merged: boolean;

  constructor(seen: TallySeen) {
    this.accepted = seen.accepted;
    this.sentBack = seen.sentBack;
    this.merged = seen.merged;
  }
}

export class TallyCountedResponseDto {
  @ApiProperty({ example: true })
  readonly failed: boolean;

  @ApiProperty({ example: false })
  readonly stopped: boolean;

  @ApiProperty({ example: true })
  readonly checksPassed: boolean;

  @ApiProperty({ example: true })
  readonly checksFailed: boolean;

  @ApiProperty({ example: true })
  readonly accepted: boolean;

  @ApiProperty({ example: true })
  readonly sentBack: boolean;

  @ApiProperty({ example: false })
  readonly handedOn: boolean;

  @ApiProperty({ example: true })
  readonly merged: boolean;

  @ApiProperty({ example: false })
  readonly withdrawn: boolean;

  constructor(counted: TallyCounted) {
    this.failed = counted.failed;
    this.stopped = counted.stopped;
    this.checksPassed = counted.checksPassed;
    this.checksFailed = counted.checksFailed;
    this.accepted = counted.accepted;
    this.sentBack = counted.sentBack;
    this.handedOn = counted.handedOn;
    this.merged = counted.merged;
    this.withdrawn = counted.withdrawn;
  }
}

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
  readonly maxInARow: number;

  @ApiProperty({ type: String, isArray: true })
  readonly taskIds: readonly string[];

  constructor(summary: TaskFailureSummary) {
    this.source = summary.source;
    this.code = summary.code;
    this.occurrences = summary.occurrences;
    this.maxInARow = summary.maxInARow;
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
    type: TallyChangesResponseDto,
    description: 'How its runs moved against the period before',
  })
  readonly changes: TallyChangesResponseDto;

  @ApiProperty({
    type: TallySeenResponseDto,
    description: 'Which of its counts were above zero in either period',
  })
  readonly seen: TallySeenResponseDto;

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
    this.changes = new TallyChangesResponseDto(report.changes);
    this.seen = new TallySeenResponseDto(report.seen);
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

  @ApiProperty({ type: RunTallyResponseDto, description: 'The whole team' })
  readonly team: RunTallyResponseDto;

  @ApiProperty({
    type: TallyChangesResponseDto,
    description: 'How the whole team’s runs moved against the period before',
  })
  readonly teamChanges: TallyChangesResponseDto;

  @ApiProperty({
    type: TallySeenResponseDto,
    description:
      'Which of the whole team’s counts were above zero in either period',
  })
  readonly teamSeen: TallySeenResponseDto;

  @ApiProperty({
    type: TallyCountedResponseDto,
    description:
      'Which of the whole team’s counts are above zero this period, so some station counted one',
  })
  readonly teamCounted: TallyCountedResponseDto;

  @ApiProperty({
    type: DayTallyResponseDto,
    isArray: true,
    description: 'The whole team’s tally per UTC day, oldest first',
  })
  readonly teamTrend: readonly DayTallyResponseDto[];

  @ApiProperty({ type: StationReportResponseDto, isArray: true })
  readonly stations: readonly StationReportResponseDto[];

  constructor(stations: InsightsStationsDto) {
    this.period = new InsightsPeriodResponseDto(stations.period);
    this.team = new RunTallyResponseDto(stations.team);
    this.teamChanges = new TallyChangesResponseDto(stations.teamChanges);
    this.teamSeen = new TallySeenResponseDto(stations.teamSeen);
    this.teamCounted = new TallyCountedResponseDto(stations.teamCounted);
    this.teamTrend = stations.teamTrend.map(
      (each) => new DayTallyResponseDto(each),
    );
    this.stations = stations.stations.map(
      (each) => new StationReportResponseDto(each),
    );
  }
}

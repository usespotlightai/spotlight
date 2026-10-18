import type {
  DeliveryFlowDto,
  FlowDto,
  InsightsFlowDto,
  StationFlowDto,
} from '@insights/application/dto/insights.dto';
import {
  DeltaResponseDto,
  deltaResponseOf,
  InsightsPeriodResponseDto,
  SpreadResponseDto,
} from '@insights/presentation/http/dto/insights-common.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class StationFlowResponseDto {
  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ example: 8, description: 'Tasks it ran for' })
  readonly tasks: number;

  @ApiProperty({
    example: 6,
    description: 'Tasks it ran for the period before; 0 where it ran none',
  })
  readonly tasksBefore: number;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'Its tasks against the period before',
  })
  readonly tasksChange: DeltaResponseDto | null;

  @ApiProperty({ type: String, isArray: true })
  readonly taskIds: readonly string[];

  @ApiProperty({ example: 11, description: 'Runs it ran' })
  readonly runs: number;

  @ApiProperty({
    type: SpreadResponseDto,
    description: 'From a run being queued to a runner taking it',
  })
  readonly queued: SpreadResponseDto;

  @ApiProperty({
    type: SpreadResponseDto,
    description: 'From a runner taking a run to the run ending',
  })
  readonly running: SpreadResponseDto;

  @ApiProperty({
    type: SpreadResponseDto,
    description:
      'From the station asking a person in the inbox to a person answering',
  })
  readonly inbox: SpreadResponseDto;

  @ApiProperty({ example: 4, description: 'Times it asked a person' })
  readonly asks: number;

  @ApiProperty({ example: 1, description: 'Asks nobody has answered yet' })
  readonly unanswered: number;

  constructor(station: StationFlowDto) {
    this.lineId = station.lineId;
    this.stationId = station.stationId;
    this.tasks = station.tasks;
    this.tasksBefore = station.tasksBefore;
    this.tasksChange = deltaResponseOf(station.tasksChange);
    this.taskIds = station.taskIds;
    this.runs = station.runs;
    this.queued = new SpreadResponseDto(station.queued);
    this.running = new SpreadResponseDto(station.running);
    this.inbox = new SpreadResponseDto(station.inbox);
    this.asks = station.asks;
    this.unanswered = station.unanswered;
  }
}

export class DeliveryDeltasResponseDto {
  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'Pull requests opened against the period before',
  })
  readonly opened: DeltaResponseDto | null;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'First reviews against the period before',
  })
  readonly reviewed: DeltaResponseDto | null;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'Pull requests merged against the period before',
  })
  readonly merged: DeltaResponseDto | null;

  constructor(changes: DeliveryFlowDto['changes']) {
    this.opened = deltaResponseOf(changes.opened);
    this.reviewed = deltaResponseOf(changes.reviewed);
    this.merged = deltaResponseOf(changes.merged);
  }
}

export class DeliveryFlowResponseDto {
  @ApiProperty({
    type: SpreadResponseDto,
    description:
      'From a task opening to its pull request opening, for pull requests opened in the period',
  })
  readonly toPullRequest: SpreadResponseDto;

  @ApiProperty({
    type: SpreadResponseDto,
    description:
      'From a pull request opening to its first review by a person, for first reviews in the period',
  })
  readonly toFirstReview: SpreadResponseDto;

  @ApiProperty({
    type: SpreadResponseDto,
    description:
      'From a pull request’s first review, or its opening where nobody reviewed it, to its merge',
  })
  readonly toMerge: SpreadResponseDto;

  @ApiProperty({ example: 14 })
  readonly opened: number;

  @ApiProperty({ example: 12 })
  readonly reviewed: number;

  @ApiProperty({ example: 11 })
  readonly merged: number;

  @ApiProperty({ type: String, isArray: true })
  readonly openedTaskIds: readonly string[];

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'The tasks whose pull requests a person first reviewed in the period',
  })
  readonly reviewedTaskIds: readonly string[];

  @ApiProperty({ type: String, isArray: true })
  readonly mergedTaskIds: readonly string[];

  @ApiProperty({
    type: DeliveryDeltasResponseDto,
    description: 'How each count moved against the period before, as long',
  })
  readonly changes: DeliveryDeltasResponseDto;

  constructor(delivery: DeliveryFlowDto) {
    this.toPullRequest = new SpreadResponseDto(delivery.toPullRequest);
    this.toFirstReview = new SpreadResponseDto(delivery.toFirstReview);
    this.toMerge = new SpreadResponseDto(delivery.toMerge);
    this.opened = delivery.opened;
    this.reviewed = delivery.reviewed;
    this.merged = delivery.merged;
    this.openedTaskIds = delivery.openedTaskIds;
    this.reviewedTaskIds = delivery.reviewedTaskIds;
    this.mergedTaskIds = delivery.mergedTaskIds;
    this.changes = new DeliveryDeltasResponseDto(delivery.changes);
  }
}

export class FlowResponseDto {
  @ApiProperty({
    type: StationFlowResponseDto,
    isArray: true,
    description:
      'Every station that ran in the period, in the order its first run ended; lay them out along the line',
  })
  readonly stations: readonly StationFlowResponseDto[];

  @ApiProperty({
    type: DeliveryFlowResponseDto,
    description: 'Past the last station: pull request, first review, merge',
  })
  readonly delivery: DeliveryFlowResponseDto;

  constructor(flow: FlowDto) {
    this.stations = flow.stations.map(
      (each) => new StationFlowResponseDto(each),
    );
    this.delivery = new DeliveryFlowResponseDto(flow.delivery);
  }
}

export class InsightsFlowResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({ type: FlowResponseDto, description: 'This period' })
  readonly flow: FlowResponseDto;

  constructor(flow: InsightsFlowDto) {
    this.period = new InsightsPeriodResponseDto(flow.period);
    this.flow = new FlowResponseDto(flow.flow);
  }
}

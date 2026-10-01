import { ApiProperty } from '@nestjs/swagger';
import type {
  ConfigMarkerDto,
  DayOutputDto,
  HeadlineDto,
  InsightsOverviewDto,
  StationWorthImprovingDto,
} from '@outcomes/application/dto/insights.dto';
import type { SignalReading } from '@outcomes/domain/services/station-ranking';
import { STATION_SIGNALS } from '@outcomes/domain/services/station-ranking';
import {
  InsightsPeriodResponseDto,
  PersonNameResponseDto,
  SpreadResponseDto,
} from '@outcomes/presentation/http/dto/insights-common.response.dto';
import { SpendResponseDto } from '@outcomes/presentation/http/dto/station-outcomes.response.dto';

export class HeadlineResponseDto {
  @ApiProperty({
    type: SpendResponseDto,
    nullable: true,
    description:
      'What the runs that ran cost together; none where nothing was priced or prices came in more than one currency',
  })
  readonly spend: SpendResponseDto | null;

  @ApiProperty({
    example: 1,
    description: 'Runs that ran with no price',
  })
  readonly unpriced: number;

  @ApiProperty({
    example: false,
    description:
      'Whether the priced runs came in more than one currency, so nothing was summed',
  })
  readonly mixedCurrencies: boolean;

  @ApiProperty({
    example: 64,
    description: 'Runs that ended in the period and ran',
  })
  readonly runs: number;

  @ApiProperty({ example: 21, description: 'Tasks those runs worked' })
  readonly tasks: number;

  @ApiProperty({ example: 12, description: 'Pull requests merged' })
  readonly mergedPullRequests: number;

  @ApiProperty({ example: 2, description: 'Pull requests closed unmerged' })
  readonly closedPullRequests: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.86,
    description:
      'Of the pull requests merged or closed in the period, the share merged',
  })
  readonly mergeRate: number | null;

  @ApiProperty({
    type: SpendResponseDto,
    nullable: true,
    description: 'Spend over merged pull requests',
  })
  readonly costPerMerge: SpendResponseDto | null;

  @ApiProperty({
    type: SpreadResponseDto,
    description:
      'For pull requests merged in the period, the time from their task opening to the merge',
  })
  readonly taskToMerge: SpreadResponseDto;

  @ApiProperty({
    example: 40,
    description:
      'What people did with the tasks worked in the period: moves, answers, approvals, refusals, sends-back',
  })
  readonly touches: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 1.9,
    description: 'Touches per task worked',
  })
  readonly touchesPerTask: number | null;

  @ApiProperty({
    example: 5,
    description: 'People who opened a task, acted on one or started a chat',
  })
  readonly activePeople: number;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The tasks whose pull requests merged',
  })
  readonly mergedTaskIds: readonly string[];

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The active people; their names are in people',
  })
  readonly peopleIds: readonly string[];

  constructor(headline: HeadlineDto) {
    this.spend = headline.spend ? new SpendResponseDto(headline.spend) : null;
    this.unpriced = headline.unpriced;
    this.mixedCurrencies = headline.mixedCurrencies;
    this.runs = headline.runs;
    this.tasks = headline.tasks;
    this.mergedPullRequests = headline.mergedPullRequests;
    this.closedPullRequests = headline.closedPullRequests;
    this.mergeRate = headline.mergeRate;
    this.costPerMerge = headline.costPerMerge
      ? new SpendResponseDto(headline.costPerMerge)
      : null;
    this.taskToMerge = new SpreadResponseDto(headline.taskToMerge);
    this.touches = headline.touches;
    this.touchesPerTask = headline.touchesPerTask;
    this.activePeople = headline.activePeople;
    this.mergedTaskIds = headline.mergedTaskIds;
    this.peopleIds = headline.peopleIds;
  }
}

export class DayOutputResponseDto {
  @ApiProperty({ example: '2026-09-30', description: 'A UTC day' })
  readonly day: string;

  @ApiProperty({
    example: 6,
    description: 'Runs that ended that day; the Runs tab lists them by day',
  })
  readonly runs: number;

  @ApiProperty({ type: SpendResponseDto, nullable: true })
  readonly spend: SpendResponseDto | null;

  @ApiProperty({
    example: 1,
    description: 'Runs that ran with no price',
  })
  readonly unpriced: number;

  @ApiProperty({
    example: false,
    description:
      'Whether the priced runs came in more than one currency, so nothing was summed',
  })
  readonly mixedCurrencies: boolean;

  @ApiProperty({ example: 2, description: 'Pull requests merged that day' })
  readonly merged: number;

  @ApiProperty({ type: String, isArray: true })
  readonly mergedTaskIds: readonly string[];

  constructor(day: DayOutputDto) {
    this.day = day.day;
    this.runs = day.runs;
    this.spend = day.spend ? new SpendResponseDto(day.spend) : null;
    this.unpriced = day.unpriced;
    this.mixedCurrencies = day.mixedCurrencies;
    this.merged = day.merged;
    this.mergedTaskIds = day.mergedTaskIds;
  }
}

export class ConfigMarkerResponseDto {
  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    example: 'a3f9…',
    description: 'The station config the station changed to',
  })
  readonly fingerprint: string;

  @ApiProperty({
    example: '2026-09-21T09:00:00.000Z',
    description: 'When the first run with it ended',
  })
  readonly firstRunAt: string;

  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly runId: string;

  constructor(marker: ConfigMarkerDto) {
    this.lineId = marker.lineId;
    this.stationId = marker.stationId;
    this.fingerprint = marker.fingerprint;
    this.firstRunAt = marker.firstRunAt;
    this.runId = marker.runId;
  }
}

export class SignalReadingResponseDto {
  @ApiProperty({
    enum: STATION_SIGNALS,
    description:
      'sent-back: share of runs sent back or refused; checks-failed: share of checked changes that failed; run-failures: share of runs that failed; task-failures: task failures per run; cost: spend per run',
  })
  readonly signal: string;

  @ApiProperty({ example: 0.4, description: 'The station, this period' })
  readonly now: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.1,
    description: 'The station, the period before',
  })
  readonly before: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.15,
    description: 'The whole team, this period',
  })
  readonly team: number | null;

  @ApiProperty({ description: 'It rose against the period before' })
  readonly rose: boolean;

  @ApiProperty({ description: 'It trails the team' })
  readonly trails: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description:
      'The currency now, before and team are spent in, for the cost signal; none for every other signal',
  })
  readonly currency: string | null;

  constructor(reading: SignalReading) {
    this.signal = reading.signal;
    this.now = reading.now;
    this.before = reading.before;
    this.team = reading.team;
    this.rose = reading.rose;
    this.trails = reading.trails;
    this.currency = reading.currency;
  }
}

export class StationWorthImprovingResponseDto {
  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ example: 9, description: 'Runs it ran this period' })
  readonly runs: number;

  @ApiProperty({
    type: SignalReadingResponseDto,
    isArray: true,
    description: 'What got worse, or is worse than the team',
  })
  readonly signals: readonly SignalReadingResponseDto[];

  @ApiProperty({
    example: 2.7,
    description:
      'How many times worse its worst signal is than what it is compared with, at most 10',
  })
  readonly worstBy: number;

  @ApiProperty({
    example: false,
    description:
      'Whether its priced runs, this period or the one before, came in more than one currency, so its cost was not compared',
  })
  readonly mixedCurrencies: boolean;

  constructor(station: StationWorthImprovingDto) {
    this.lineId = station.lineId;
    this.stationId = station.stationId;
    this.runs = station.runs;
    this.signals = station.signals.map(
      (each) => new SignalReadingResponseDto(each),
    );
    this.worstBy = station.worstBy;
    this.mixedCurrencies = station.mixedCurrencies;
  }
}

export class InsightsOverviewResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    example: false,
    description:
      'Whether the team ran more than 20,000 runs over the period and the one before, so only the latest 20,000 were counted',
  })
  readonly truncated: boolean;

  @ApiProperty({ type: HeadlineResponseDto, description: 'This period' })
  readonly headline: HeadlineResponseDto;

  @ApiProperty({
    type: HeadlineResponseDto,
    description: 'The period before, as long',
  })
  readonly before: HeadlineResponseDto;

  @ApiProperty({
    type: DayOutputResponseDto,
    isArray: true,
    description: 'Spend and merged pull requests per day, oldest first',
  })
  readonly output: readonly DayOutputResponseDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description:
      'The one currency every day’s spend was priced in; none where nothing was priced or prices came in more than one',
  })
  readonly outputCurrency: string | null;

  @ApiProperty({
    example: false,
    description: 'Whether the period’s prices came in more than one currency',
  })
  readonly outputMixedCurrencies: boolean;

  @ApiProperty({
    type: ConfigMarkerResponseDto,
    isArray: true,
    description: 'Each time a station ran with a new config this period',
  })
  readonly configChanges: readonly ConfigMarkerResponseDto[];

  @ApiProperty({
    type: StationWorthImprovingResponseDto,
    isArray: true,
    description:
      'Stations with at least three runs whose signals rose against the period before or trail the team, the most signals first',
  })
  readonly worthImproving: readonly StationWorthImprovingResponseDto[];

  @ApiProperty({ type: PersonNameResponseDto, isArray: true })
  readonly people: readonly PersonNameResponseDto[];

  constructor(overview: InsightsOverviewDto) {
    this.period = new InsightsPeriodResponseDto(overview.period);
    this.truncated = overview.truncated;
    this.headline = new HeadlineResponseDto(overview.headline);
    this.before = new HeadlineResponseDto(overview.before);
    this.output = overview.output.map((each) => new DayOutputResponseDto(each));
    this.outputCurrency = overview.outputCurrency;
    this.outputMixedCurrencies = overview.outputMixedCurrencies;
    this.configChanges = overview.configChanges.map(
      (each) => new ConfigMarkerResponseDto(each),
    );
    this.worthImproving = overview.worthImproving.map(
      (each) => new StationWorthImprovingResponseDto(each),
    );
    this.people = overview.people.map(
      (each) => new PersonNameResponseDto(each),
    );
  }
}

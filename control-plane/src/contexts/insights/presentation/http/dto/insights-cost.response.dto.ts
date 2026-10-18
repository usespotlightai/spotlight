import type {
  CacheUseDto,
  CostBreakdownDto,
  CostSliceDto,
  FlowLinkDto,
  FlowNodeDto,
  InsightsCostDto,
  StationCacheUseDto,
} from '@insights/application/dto/insights.dto';
import { FLOW_NODE_KINDS } from '@insights/domain/services/cost-breakdown';
import {
  DeltaResponseDto,
  deltaResponseOf,
  InsightsPeriodResponseDto,
} from '@insights/presentation/http/dto/insights-common.response.dto';
import { MoneyResponseDto } from '@insights/presentation/http/dto/station-insights.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CostSliceResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'claude-sonnet-4',
    description:
      'What the slice is: a harness, model, station id or repository; none for the harness’s own model or runs with no repository',
  })
  readonly key: string | null;

  @ApiProperty({ example: 4.2, description: 'In the spend’s currency' })
  readonly amount: number;

  @ApiProperty({ example: 11, description: 'Runs in the slice' })
  readonly runs: number;

  constructor(slice: CostSliceDto) {
    this.key = slice.key;
    this.amount = slice.amount;
    this.runs = slice.runs;
  }
}

export class CacheUseResponseDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 120_000,
    description:
      'Input tokens of the runs that counted both input and cache reads, not counting tokens read from or written to cache; none where no run did',
  })
  readonly input: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 2_400_000,
    description: 'Cache-read tokens of those same runs',
  })
  readonly cacheRead: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 80_000,
    description:
      'Cache-write tokens of those same runs; none where none of them counted any',
  })
  readonly cacheWrite: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.95,
    description:
      'Cache reads as a fraction of everything the runs read: input, cache reads and cache writes together; none where nothing was counted',
  })
  readonly cacheRate: number | null;

  constructor(cache: CacheUseDto) {
    this.input = cache.input;
    this.cacheRead = cache.cacheRead;
    this.cacheWrite = cache.cacheWrite;
    this.cacheRate = cache.cacheRate;
  }
}

export class StationCacheUseResponseDto extends CacheUseResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  constructor(cache: StationCacheUseDto) {
    super(cache);
    this.stationId = cache.stationId;
  }
}

export class CostFlowNodeResponseDto {
  @ApiProperty({ example: 'model:claude-sonnet-4' })
  readonly id: string;

  @ApiProperty({ enum: FLOW_NODE_KINDS })
  readonly kind: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'claude-sonnet-4',
    description:
      'The model, station id or repository; none for the harness’s own model or no repository',
  })
  readonly key: string | null;

  constructor(node: FlowNodeDto) {
    this.id = node.id;
    this.kind = node.kind;
    this.key = node.key;
  }
}

export class CostFlowLinkResponseDto {
  @ApiProperty({ example: 'model:claude-sonnet-4' })
  readonly source: string;

  @ApiProperty({ example: 'station:d41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly target: string;

  @ApiProperty({ example: 2.1, description: 'In the spend’s currency' })
  readonly amount: number;

  constructor(link: FlowLinkDto) {
    this.source = link.source;
    this.target = link.target;
    this.amount = link.amount;
  }
}

export class CostBreakdownResponseDto {
  @ApiProperty({
    type: MoneyResponseDto,
    nullable: true,
    description:
      'Spend this period; none, and every slice empty, where nothing was priced or prices came in more than one currency',
  })
  readonly spend: MoneyResponseDto | null;

  @ApiProperty({ example: 1, description: 'Runs that ran with no price' })
  readonly unpriced: number;

  @ApiProperty({
    example: false,
    description:
      'Whether the priced runs came in more than one currency, so nothing was summed',
  })
  readonly mixedCurrencies: boolean;

  @ApiProperty({ type: CostSliceResponseDto, isArray: true })
  readonly byHarness: readonly CostSliceResponseDto[];

  @ApiProperty({ type: CostSliceResponseDto, isArray: true })
  readonly byModel: readonly CostSliceResponseDto[];

  @ApiProperty({ type: CostSliceResponseDto, isArray: true })
  readonly byStation: readonly CostSliceResponseDto[];

  @ApiProperty({
    type: CostSliceResponseDto,
    isArray: true,
    description:
      'A run that worked several repositories splits its cost evenly among them',
  })
  readonly byRepository: readonly CostSliceResponseDto[];

  @ApiProperty({
    type: CostFlowNodeResponseDto,
    isArray: true,
    description: 'Models, stations and repositories, for a Sankey diagram',
  })
  readonly nodes: readonly CostFlowNodeResponseDto[];

  @ApiProperty({
    type: CostFlowLinkResponseDto,
    isArray: true,
    description: 'Spend from model to station, and station to repository',
  })
  readonly links: readonly CostFlowLinkResponseDto[];

  @ApiProperty({
    type: CacheUseResponseDto,
    description:
      'How much of what the runs read came from cache; runs with unknown counts are left out',
  })
  readonly cache: CacheUseResponseDto;

  @ApiProperty({
    type: StationCacheUseResponseDto,
    isArray: true,
  })
  readonly cacheByStation: readonly StationCacheUseResponseDto[];

  constructor(cost: CostBreakdownDto) {
    this.spend = cost.spend ? new MoneyResponseDto(cost.spend) : null;
    this.unpriced = cost.unpriced;
    this.mixedCurrencies = cost.mixedCurrencies;
    this.byHarness = cost.byHarness.map(
      (each) => new CostSliceResponseDto(each),
    );
    this.byModel = cost.byModel.map((each) => new CostSliceResponseDto(each));
    this.byStation = cost.byStation.map(
      (each) => new CostSliceResponseDto(each),
    );
    this.byRepository = cost.byRepository.map(
      (each) => new CostSliceResponseDto(each),
    );
    this.nodes = cost.nodes.map((each) => new CostFlowNodeResponseDto(each));
    this.links = cost.links.map((each) => new CostFlowLinkResponseDto(each));
    this.cache = new CacheUseResponseDto(cost.cache);
    this.cacheByStation = cost.cacheByStation.map(
      (each) => new StationCacheUseResponseDto(each),
    );
  }
}

export class InsightsCostResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({ type: CostBreakdownResponseDto })
  readonly cost: CostBreakdownResponseDto;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description:
      'Spend against the period before, where both periods were priced in one currency',
  })
  readonly spendChange: DeltaResponseDto | null;

  constructor(cost: InsightsCostDto) {
    this.period = new InsightsPeriodResponseDto(cost.period);
    this.cost = new CostBreakdownResponseDto(cost.cost);
    this.spendChange = deltaResponseOf(cost.spendChange);
  }
}

import { ApiProperty } from '@nestjs/swagger';
import type {
  FlaggedMemoryDto,
  InsightsMemoryDto,
  MemoryBenchmarkDto,
} from '@outcomes/application/dto/insights-memory.dto';
import { InsightsPeriodResponseDto } from '@outcomes/presentation/http/dto/insights-common.response.dto';
import { MeasureVerdictResponseDto } from '@outcomes/presentation/http/dto/measure-verdict.response.dto';
import { RunTallyResponseDto } from '@outcomes/presentation/http/dto/station-outcomes.response.dto';

export class FlaggedMemoryResponseDto {
  @ApiProperty({ example: 'mem_1' })
  readonly memoryId: string;

  @ApiProperty({ example: 'M-12' })
  readonly handle: string;

  @ApiProperty({ example: 'Run the migrations before the tests.' })
  readonly body: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'We stopped doing this in August',
    description: 'Why the person said it was wrong',
  })
  readonly reason: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'user_ada' })
  readonly by: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Ada Lovelace' })
  readonly byName: string | null;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly at: string;

  constructor(flagged: FlaggedMemoryDto) {
    this.memoryId = flagged.memoryId;
    this.handle = flagged.handle;
    this.body = flagged.body;
    this.reason = flagged.reason;
    this.by = flagged.by;
    this.byName = flagged.byName;
    this.at = flagged.at;
  }
}

export class MemoryBenchmarkResponseDto {
  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly ranAt: string;

  @ApiProperty({
    example: 0.8,
    description: 'Share of the benchmark’s cases solved with memories',
  })
  readonly withMemories: number;

  @ApiProperty({
    example: 0.6,
    description: 'Share of the benchmark’s cases solved without them',
  })
  readonly withoutMemories: number;

  @ApiProperty({ example: 20 })
  readonly cases: number;

  constructor(benchmark: MemoryBenchmarkDto) {
    this.ranAt = benchmark.ranAt;
    this.withMemories = benchmark.withMemories;
    this.withoutMemories = benchmark.withoutMemories;
    this.cases = benchmark.cases;
  }
}

export class InsightsMemoryResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    example: 14,
    description: 'Approved memories the team has now',
  })
  readonly activeCount: number;

  @ApiProperty({
    example: 9,
    description: 'Memories briefed to at least one run in the period',
  })
  readonly memoriesBriefed: number;

  @ApiProperty({
    example: 4,
    description: 'Memories a run read for itself in the period',
  })
  readonly memoriesRecalled: number;

  @ApiProperty({ example: 30, description: 'Runs briefed any memory' })
  readonly runsBriefed: number;

  @ApiProperty({ example: 8, description: 'Runs that read any memory' })
  readonly runsRecalled: number;

  @ApiProperty({
    type: FlaggedMemoryResponseDto,
    isArray: true,
    description:
      'Memories a person retired as wrong in the period, rather than a newer memory replacing them, the latest first',
  })
  readonly flagged: readonly FlaggedMemoryResponseDto[];

  @ApiProperty({
    type: RunTallyResponseDto,
    description: 'How runs that were briefed or read a memory turned out',
  })
  readonly withMemories: RunTallyResponseDto;

  @ApiProperty({
    type: RunTallyResponseDto,
    description: 'How the rest of the runs turned out',
  })
  readonly withoutMemories: RunTallyResponseDto;

  @ApiProperty({
    type: MeasureVerdictResponseDto,
    isArray: true,
    description:
      'Each measure over the runs without memories against the runs with them, and whether runs with memories did better',
  })
  readonly verdicts: readonly MeasureVerdictResponseDto[];

  @ApiProperty({
    type: MemoryBenchmarkResponseDto,
    nullable: true,
    description: 'The latest memory benchmark run for the team, if any',
  })
  readonly benchmark: MemoryBenchmarkResponseDto | null;

  constructor(memory: InsightsMemoryDto) {
    this.period = new InsightsPeriodResponseDto(memory.period);
    this.activeCount = memory.activeCount;
    this.memoriesBriefed = memory.memoriesBriefed;
    this.memoriesRecalled = memory.memoriesRecalled;
    this.runsBriefed = memory.runsBriefed;
    this.runsRecalled = memory.runsRecalled;
    this.flagged = memory.flagged.map(
      (each) => new FlaggedMemoryResponseDto(each),
    );
    this.withMemories = new RunTallyResponseDto(memory.withMemories);
    this.withoutMemories = new RunTallyResponseDto(memory.withoutMemories);
    this.verdicts = memory.verdicts.map(
      (each) => new MeasureVerdictResponseDto(each),
    );
    this.benchmark = memory.benchmark
      ? new MemoryBenchmarkResponseDto(memory.benchmark)
      : null;
  }
}

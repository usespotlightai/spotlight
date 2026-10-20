import { ApiProperty } from '@nestjs/swagger';
import type {
  SearchRunDto,
  SearchRunSpentDto,
} from '@work/application/dto/search-run.dto';
import { RunAgentResponseDto } from '@work/presentation/http/dto/run-agent.response.dto';
import { RunJournalResponseDto } from '@work/presentation/http/dto/run-journal.response.dto';
import {
  RunSpendResponseDto,
  RunStationResponseDto,
  TaskRunResponseDto,
} from '@work/presentation/http/dto/task-run.response.dto';
import { RunJournalHttpMapper } from '@work/presentation/http/mappers/run-journal.http.mapper';

export class SearchRunCostResponseDto {
  @ApiProperty({ example: 0.42 })
  readonly amount: number;

  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  constructor(cost: { readonly amount: number; readonly currency: string }) {
    this.amount = cost.amount;
    this.currency = cost.currency;
  }
}

export class SearchRunSpentResponseDto {
  @ApiProperty({
    type: SearchRunCostResponseDto,
    isArray: true,
    description:
      'What its model calls cost, one sum per currency, across every attempt',
  })
  readonly spentCosts: SearchRunCostResponseDto[];

  @ApiProperty({
    description:
      'Model sessions that came back with no price; the search charges each its agent run’s whole share',
  })
  readonly unpricedCalls: number;

  constructor(spent: SearchRunSpentDto) {
    this.spentCosts = spent.spentCosts.map(
      (each) => new SearchRunCostResponseDto(each),
    );
    this.unpricedCalls = spent.unpricedCalls;
  }
}

export class SearchRunResponseDto extends TaskRunResponseDto {
  @ApiProperty({ description: 'The search this run is an iteration of' })
  readonly searchId: string;

  @ApiProperty({ example: 1 })
  readonly iteration: number;

  @ApiProperty({
    nullable: true,
    type: RunAgentResponseDto,
    description: 'The harness, model and effort the search ran its agent on',
  })
  readonly agent: RunAgentResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'How the run failed, once it did',
  })
  readonly failure: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly endedAt: string | null;

  @ApiProperty({ type: SearchRunSpentResponseDto })
  readonly spent: SearchRunSpentResponseDto;

  @ApiProperty({ type: RunSpendResponseDto, nullable: true })
  readonly spend: RunSpendResponseDto | null;

  @ApiProperty({
    type: RunJournalResponseDto,
    isArray: true,
    description: 'What it did and wrote, attempt by attempt',
  })
  readonly journals: RunJournalResponseDto[];

  @ApiProperty({
    description:
      'The briefing that the search sent to its agent when it dispatched this iteration',
  })
  readonly briefing: string;

  constructor(run: SearchRunDto) {
    super(
      run.id,
      run.state,
      run.attempt,
      run.exitCode,
      run.startedAt,
      run.updatedAt,
      run.harness,
      run.image,
      run.station
        ? new RunStationResponseDto(
            run.station.id,
            run.station.name,
            run.station.color,
            run.station.position,
            run.station.count,
          )
        : null,
      null,
      run.work,
    );
    this.searchId = run.searchId;
    this.iteration = run.iteration;
    this.agent = run.agent ? new RunAgentResponseDto(run.agent) : null;
    this.failure = run.failure;
    this.endedAt = run.endedAt;
    this.spent = new SearchRunSpentResponseDto(run.spent);
    this.spend = run.spend
      ? new RunSpendResponseDto(
          run.spend.cost,
          run.spend.currency,
          run.spend.inputTokens,
          run.spend.outputTokens,
          run.spend.cacheReadTokens,
          run.spend.cacheWriteTokens,
        )
      : null;
    this.journals = run.journals.map(RunJournalHttpMapper.toResponse);
    this.briefing = run.briefing;
  }
}

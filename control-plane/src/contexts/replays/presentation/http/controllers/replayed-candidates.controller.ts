import { Get, HttpStatus, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import type { ReplayedCandidatesDto } from '@replays/application/dto/replayed-candidates.dto';
import { MAX_REPLAYED } from '@replays/application/queries/handlers/read-replayed-candidates.handler';
import { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import { REPLAYED_PERIODS } from '@replays/domain/value-objects/replayed-period.vo';
import { ReplayedCandidatesResponseDto } from '@replays/presentation/http/dto/replayed-candidates.response.dto';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const DEFAULT_PERIOD = '30d';

const periodOf = (raw: unknown): string => {
  if (raw === undefined) {
    return DEFAULT_PERIOD;
  }

  return typeof raw === 'string' ? raw : '';
};

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(HttpStatus.NOT_FOUND, 'No such team for this caller')
export class ReplayedCandidatesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('replayed-candidates')
  @ApiOperation({
    operationId: 'readReplayedCandidates',
    summary:
      'The station configs the team replayed over past tasks in the period, by station and replay set, each beside its set’s baseline, the live config replayed',
    description: `Searched candidates show when their search started in the period, proposed ones when their replay did; pull-request checks are left out, and the live config shows only as each set’s baseline. A candidate’s success rate is its replay’s, scored by its own checks and judge on past tasks, not how live runs went; its numbers are the ones its search and replay pages show. Each set’s health and baseline ignore the period. It covers the newest ${MAX_REPLAYED} replays of the period.`,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: REPLAYED_PERIODS,
    description:
      'How many whole UTC days, up to and including today, to look at; 30d by default',
  })
  @ApiOkResponse({ type: ReplayedCandidatesResponseDto })
  @ApiProblemResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'No such period')
  async read(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayedCandidatesResponseDto> {
    return new ReplayedCandidatesResponseDto(
      await this.queryBus.execute<
        ReadReplayedCandidatesQuery,
        ReplayedCandidatesDto
      >(new ReadReplayedCandidatesQuery(teamId, principal, periodOf(period))),
    );
  }
}

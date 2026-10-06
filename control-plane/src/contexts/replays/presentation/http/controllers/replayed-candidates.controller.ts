import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
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
import type { ConfigOriginsDto } from '@replays/application/dto/config-origins.dto';
import type { ReplayedCandidatesDto } from '@replays/application/dto/replayed-candidates.dto';
import { MOST_REPLAYED } from '@replays/application/queries/handlers/read-replayed-candidates.handler';
import { ReadConfigOriginsQuery } from '@replays/application/queries/read-config-origins.query';
import { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import { MOST_CHANGES } from '@replays/domain/services/changes-asked-about';
import { REPLAYED_PERIODS } from '@replays/domain/value-objects/replayed-period.vo';
import { changesIn } from '@replays/presentation/http/controllers/requests';
import { ReadConfigOriginsRequestDto } from '@replays/presentation/http/dto/config-origins.request.dto';
import { ConfigOriginsResponseDto } from '@replays/presentation/http/dto/config-origins.response.dto';
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
    description: `Searched candidates show when their search started in the period, proposed ones when their replay did; pull-request checks are left out, and the live config shows only as each set’s baseline. A candidate’s success rate is its replay’s, scored by its own checks and judge on past tasks, not how live runs went; its numbers are the ones its search and replay pages show. Each set’s health and baseline ignore the period. It covers the newest ${MOST_REPLAYED} replays of the period.`,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: REPLAYED_PERIODS,
    description:
      'How many whole UTC days, up to and including today, to look at; 30d unless asked',
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

  @Post('config-origins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'readConfigOrigins',
    summary:
      'The searched or proposed candidate each station config change came from, replayed or not; nothing is written',
    description: `Origins are worked out when asked, from the runs the team has kept. Each change is named by its station and the run it took effect with, as the team's insights change markers name them. A station changes config when a run that ran a config began with another config than the run that began before it there, ties broken by run; a run asked about that did not change its station's config has no origin. Otherwise its origin is the newest-made candidate at the station with the config it changed to, found by a search or proposed by a person or Terraform, made no later than the run began, among those the caller can see at stations that still exist, including candidates withdrawn since, which come back with withdrawn set. Deleting a task's runs changes the answer. The live config, sanity replays and pull-request check candidates are never an origin. Changes with no origin are left out; a run asked about twice at a station is answered once. At most ${MOST_CHANGES} changes.`,
  })
  @ApiBody({ type: ReadConfigOriginsRequestDto })
  @ApiOkResponse({ type: ConfigOriginsResponseDto })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'A change with a blank station or run, or too many changes',
  )
  async configOrigins(
    @Param('teamId') teamId: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ConfigOriginsResponseDto> {
    return new ConfigOriginsResponseDto(
      await this.queryBus.execute<ReadConfigOriginsQuery, ConfigOriginsDto>(
        new ReadConfigOriginsQuery(teamId, principal, changesIn(body)),
      ),
    );
  }
}

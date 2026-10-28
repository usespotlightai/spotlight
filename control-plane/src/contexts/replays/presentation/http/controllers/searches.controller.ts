import {
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { StopSearchCommand } from '@replays/application/commands/stop-search.command';
import type { SearchStoppedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type {
  SearchDetailDto,
  SearchSummaryDto,
} from '@replays/application/dto/searches.dto';
import { ListSearchesQuery } from '@replays/application/queries/list-searches.query';
import { ListTeamSearchesQuery } from '@replays/application/queries/list-team-searches.query';
import { ReadSearchQuery } from '@replays/application/queries/read-search.query';
import { allowed } from '@replays/presentation/http/controllers/requests';
import {
  SearchDetailResponseDto,
  SearchResponseDto,
} from '@replays/presentation/http/dto/searches.response.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const SEARCH = 'replay search';

const STATION = 'lines/:lineId/stations/:stationId';

const PAGE = 50;

const LONGEST_PAGE = 200;

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(
  HttpStatus.NOT_FOUND,
  'No such team, station, set or search for this caller',
)
export class SearchesController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(`${STATION}/searches`)
  @ApiOperation({
    operationId: 'listSearches',
    summary:
      'The station’s searches for a better config, newest first, with what each spent and its best find',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiOkResponse({ type: SearchResponseDto, isArray: true })
  async list(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SearchResponseDto[]> {
    const searches = await this.queryBus.execute<
      ListSearchesQuery,
      readonly SearchSummaryDto[]
    >(new ListSearchesQuery(teamId, lineId, stationId, principal));

    return searches.map((each) => new SearchResponseDto(each));
  }

  @Get('searches')
  @ApiOperation({
    operationId: 'listTeamSearches',
    summary:
      'The team’s searches, newest first, a page at a time, with each one’s station, how it went and its best find',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    description:
      'Only searches started before this one, by its id; a search that the team does not own answers an empty page',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `At most this many, up to ${LONGEST_PAGE}; ${PAGE} unless told`,
  })
  @ApiOkResponse({ type: SearchResponseDto, isArray: true })
  async listOfTeam(
    @Param('teamId') teamId: string,
    @Query('before') before: string | undefined,
    @Query('limit', new ParseIntPipe({ optional: true })) limit:
      | number
      | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SearchResponseDto[]> {
    const searches = await this.queryBus.execute<
      ListTeamSearchesQuery,
      readonly SearchSummaryDto[]
    >(
      new ListTeamSearchesQuery(teamId, principal, {
        before: before || null,
        limit: Math.min(Math.max(limit ?? PAGE, 1), LONGEST_PAGE),
      }),
    );

    return searches.map((each) => new SearchResponseDto(each));
  }

  @Get('searches/:searchId')
  @ApiOperation({
    operationId: 'readSearch',
    summary:
      'One search: its budget and spend, its held-out split, each iteration and candidate with its scores, and the frontier',
  })
  @ApiParam({ name: 'searchId', type: String })
  @ApiOkResponse({ type: SearchDetailResponseDto })
  async read(
    @Param('teamId') teamId: string,
    @Param('searchId') searchId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SearchDetailResponseDto> {
    return new SearchDetailResponseDto(
      await this.queryBus.execute<ReadSearchQuery, SearchDetailDto>(
        new ReadSearchQuery(teamId, searchId, principal),
      ),
    );
  }

  @Post('searches/:searchId/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'stopSearch',
    summary:
      'Stop a search: its agent run stops, its replays stop, and nothing more starts',
  })
  @ApiParam({ name: 'searchId', type: String })
  @ApiNoContentResponse({ description: 'Stopped' })
  @ApiProblemResponse(HttpStatus.CONFLICT, 'The search has already ended')
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async stop(
    @Param('teamId') teamId: string,
    @Param('searchId') searchId: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    allowed(
      SEARCH,
      await this.commandBus.execute<StopSearchCommand, SearchStoppedOutcome>(
        new StopSearchCommand(teamId, searchId, actor),
      ),
    );
  }
}

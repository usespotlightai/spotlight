import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiCreatedResponse,
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
import { ProblemException } from '@platform/http/resources/problem.exception';
import { PickSearchCandidateCommand } from '@replays/application/commands/pick-search-candidate.command';
import { StartSearchCommand } from '@replays/application/commands/start-search.command';
import { StopSearchCommand } from '@replays/application/commands/stop-search.command';
import type {
  CandidatePicked,
  SearchRefused,
  SearchStartedOutcome,
  SearchStoppedOutcome,
} from '@replays/application/dto/replay-outcomes.dto';
import type {
  SearchDetailDto,
  SearchEstimateDto,
  SearchSummaryDto,
} from '@replays/application/dto/searches.dto';
import { EstimateSearchQuery } from '@replays/application/queries/estimate-search.query';
import { ListSearchesQuery } from '@replays/application/queries/list-searches.query';
import { ListTeamSearchesQuery } from '@replays/application/queries/list-team-searches.query';
import { ReadSearchQuery } from '@replays/application/queries/read-search.query';
import {
  allowed,
  objectiveIn,
  searchAgentIn,
  searchBudgetIn,
  textAt,
} from '@replays/presentation/http/controllers/requests';
import { ConfigPullRequestResponseDto } from '@replays/presentation/http/dto/config-pull-requests.response.dto';
import {
  EstimateSearchRequestDto,
  SearchDetailResponseDto,
  SearchEstimateResponseDto,
  SearchResponseDto,
  SearchStartedResponseDto,
  StartSearchRequestDto,
} from '@replays/presentation/http/dto/searches.response.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const SEARCH = 'replay search';

const STATION = 'lines/:lineId/stations/:stationId';

const accepted = <T extends object>(answer: T | SearchRefused): T => {
  if ('problems' in answer) {
    throw ProblemException.invalid(SEARCH, answer.problems);
  }

  return answer;
};

const PAGE = 50;

const LONGEST_PAGE = 200;

const SET_SAYS = 'must name a replay set at the station';

interface Answerable {
  status(code: number): unknown;
}

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

  @Post(`${STATION}/searches/estimate`)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'estimateSearch',
    summary:
      'What a search over a set would start, spend and take, before starting it; nothing is written',
    description:
      'The runs count every replay and agent run the budget allows; the ceilings are the ones each replay would get; the duration is rough, from how long the set’s runs took, at the search’s concurrency.',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiBody({ type: EstimateSearchRequestDto })
  @ApiOkResponse({ type: SearchEstimateResponseDto })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'A budget out of bounds, a ceiling too low to give each replay a cent, or a set with too few tasks to hold some out',
  )
  async estimate(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SearchEstimateResponseDto> {
    return new SearchEstimateResponseDto(
      accepted(
        await this.queryBus.execute<
          EstimateSearchQuery,
          SearchEstimateDto | SearchRefused
        >(
          new EstimateSearchQuery(
            teamId,
            lineId,
            stationId,
            textAt(body, 'setId', SET_SAYS),
            searchBudgetIn(body),
            objectiveIn(body),
            principal,
          ),
        ),
      ),
    );
  }

  @Post(`${STATION}/searches`)
  @ApiOperation({
    operationId: 'startSearch',
    summary:
      'Start a search for a better config of the station, over one of its replay sets, within a budget',
    description:
      'It holds out about 30% of the set’s tasks, replays the live config over the whole set, then runs its agent once per iteration to propose candidates, each replayed on the tasks it did not hold out. The best are replayed on the held-out tasks once it stops searching. The set cannot change while it runs, and a station is searched once at a time.',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiBody({ type: StartSearchRequestDto })
  @ApiCreatedResponse({ type: SearchStartedResponseDto })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'A harness no runner starts, a budget out of bounds, a ceiling too low, or a set with too few tasks to hold some out',
  )
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The station is being searched already, or its set’s station is gone',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async start(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<SearchStartedResponseDto> {
    return new SearchStartedResponseDto(
      accepted(
        allowed(
          SEARCH,
          await this.commandBus.execute<
            StartSearchCommand,
            SearchStartedOutcome
          >(
            new StartSearchCommand(
              teamId,
              lineId,
              stationId,
              textAt(body, 'setId', SET_SAYS),
              searchAgentIn(body),
              searchBudgetIn(body),
              objectiveIn(body),
              actor,
            ),
          ),
        ),
      ),
    );
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
      'Only searches started before this one, by its id; a search the team does not hold answers an empty page',
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

  @Post('searches/:searchId/candidates/:candidateId/pick')
  @ApiOperation({
    operationId: 'pickSearchCandidate',
    summary:
      'Pick a candidate of a search: Spotlight opens a pull request that changes the station in the line’s Terraform, in the repository its source names',
    description:
      'Spotlight never applies the change itself. It edits the station block of the line’s spotlight_line resource (and a prompt file read with file()), commits to its own branch and opens the pull request; until then the pull request is opening. Picking it again answers the same one, unless it was refused, which tries again.',
  })
  @ApiParam({ name: 'searchId', type: String })
  @ApiParam({ name: 'candidateId', type: String })
  @ApiCreatedResponse({
    type: ConfigPullRequestResponseDto,
    description: 'Picked, or tried again after a refusal',
  })
  @ApiOkResponse({
    type: ConfigPullRequestResponseDto,
    description: 'Picked already; the pull request it opens or opened',
  })
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The seed, or a candidate whose replay on the searched tasks has not finished',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async pick(
    @Param('teamId') teamId: string,
    @Param('searchId') searchId: string,
    @Param('candidateId') candidateId: string,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<ConfigPullRequestResponseDto> {
    const picked = allowed(
      SEARCH,
      await this.commandBus.execute<
        PickSearchCandidateCommand,
        CandidatePicked
      >(new PickSearchCandidateCommand(teamId, searchId, candidateId, actor)),
    );

    if (picked.outcome === 'already') {
      response.status(HttpStatus.OK);
    }

    return new ConfigPullRequestResponseDto(picked.pullRequest);
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

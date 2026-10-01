import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type {
  InsightsCostDto,
  InsightsFlowDto,
  InsightsOverviewDto,
  InsightsPeopleDto,
  InsightsRunsDto,
  InsightsStationsDto,
} from '@outcomes/application/dto/insights.dto';
import { ListInsightsRunsQuery } from '@outcomes/application/queries/list-insights-runs.query';
import { ReadInsightsCostQuery } from '@outcomes/application/queries/read-insights-cost.query';
import { ReadInsightsFlowQuery } from '@outcomes/application/queries/read-insights-flow.query';
import { ReadInsightsOverviewQuery } from '@outcomes/application/queries/read-insights-overview.query';
import { ReadInsightsPeopleQuery } from '@outcomes/application/queries/read-insights-people.query';
import { ReadInsightsStationsQuery } from '@outcomes/application/queries/read-insights-stations.query';
import {
  HARNESS_DEFAULT_MODEL,
  MOST_FILTERED_TASKS,
  NO_REPOSITORY,
} from '@outcomes/domain/services/run-filter';
import { MOST_RUN_PAGE } from '@outcomes/domain/services/run-page';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { INSIGHTS_PERIODS } from '@outcomes/domain/value-objects/insights-period.vo';
import { PERSON_ACTS } from '@outcomes/domain/value-objects/next-act.vo';
import { RUN_ENDINGS } from '@outcomes/domain/value-objects/run-ending';
import { InsightsCostResponseDto } from '@outcomes/presentation/http/dto/insights-cost.response.dto';
import { InsightsFlowResponseDto } from '@outcomes/presentation/http/dto/insights-flow.response.dto';
import { InsightsOverviewResponseDto } from '@outcomes/presentation/http/dto/insights-overview.response.dto';
import { InsightsPeopleResponseDto } from '@outcomes/presentation/http/dto/insights-people.response.dto';
import { InsightsRunsResponseDto } from '@outcomes/presentation/http/dto/insights-runs.response.dto';
import { InsightsStationsResponseDto } from '@outcomes/presentation/http/dto/insights-stations.response.dto';
import { AdmitsWorkspaceTokens } from '@platform/http/decorators/admits-workspace-tokens.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const DEFAULT_PERIOD = '30d';

const periodOf = (raw: unknown): string => {
  if (raw === undefined) {
    return DEFAULT_PERIOD;
  }

  return typeof raw === 'string' ? raw : '';
};

const textOf = (raw: unknown): string | null =>
  typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;

const askedOf = (raw: unknown): string | readonly string[] | null =>
  Array.isArray(raw) ? raw.map(String) : textOf(raw);

const listOf = (raw: unknown): readonly string[] | null => {
  const text = textOf(raw);

  return text === null
    ? null
    : text
        .split(',')
        .map((each) => each.trim())
        .filter((each) => each.length > 0);
};

const numberOf = (raw: unknown): number | null => {
  const asked = typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isInteger(asked) ? asked : null;
};

const PeriodQuery = () =>
  ApiQuery({
    name: 'period',
    required: false,
    enum: INSIGHTS_PERIODS,
    description:
      'How many whole UTC days, up to and including today, to look at; 30d unless asked. Every answer also covers the period before, as long',
  });

const FilterQuery = (name: string, description: string) =>
  ApiQuery({ name, required: false, type: String, description });

@ApiTags('insights')
@ApiBearerAuth()
@AdmitsWorkspaceTokens()
@ApiUnauthorizedResponse({ description: 'No valid session or token' })
@ApiNotFoundResponse({ description: 'No such team for this caller' })
@ApiUnprocessableEntityResponse({
  description:
    'No such period, or a filter it does not take: more tasks than it takes, an unknown value, a value repeated where it takes one, a day outside the period, or a page past the last',
})
@ApiParam({ name: 'teamId', type: String })
@Controller('teams/:teamId/insights')
export class TeamInsightsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('overview')
  @ApiOperation({
    operationId: 'readInsightsOverview',
    summary:
      'The team’s headline numbers against the period before, output against cost per day, config changes and the stations worth improving',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsOverviewResponseDto })
  async overview(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsOverviewResponseDto> {
    return new InsightsOverviewResponseDto(
      await this.queryBus.execute<
        ReadInsightsOverviewQuery,
        InsightsOverviewDto
      >(new ReadInsightsOverviewQuery(teamId, principal, periodOf(period))),
    );
  }

  @Get('flow')
  @ApiOperation({
    operationId: 'readInsightsFlow',
    summary:
      'Where the team’s tasks wait at each station, queued, running or in the inbox, and on to pull request, first review and merge',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsFlowResponseDto })
  async flow(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsFlowResponseDto> {
    return new InsightsFlowResponseDto(
      await this.queryBus.execute<ReadInsightsFlowQuery, InsightsFlowDto>(
        new ReadInsightsFlowQuery(teamId, principal, periodOf(period)),
      ),
    );
  }

  @Get('stations')
  @ApiOperation({
    operationId: 'readInsightsStations',
    summary:
      'How each station’s runs went, per day and against the period before, with its task failures apart from its run failures',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsStationsResponseDto })
  async stations(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsStationsResponseDto> {
    return new InsightsStationsResponseDto(
      await this.queryBus.execute<
        ReadInsightsStationsQuery,
        InsightsStationsDto
      >(new ReadInsightsStationsQuery(teamId, principal, periodOf(period))),
    );
  }

  @Get('people')
  @ApiOperation({
    operationId: 'readInsightsPeople',
    summary:
      'What the team’s work asks of people, and who is using Spotlight: active, new, weekly and monthly',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsPeopleResponseDto })
  async people(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsPeopleResponseDto> {
    return new InsightsPeopleResponseDto(
      await this.queryBus.execute<ReadInsightsPeopleQuery, InsightsPeopleDto>(
        new ReadInsightsPeopleQuery(teamId, principal, periodOf(period)),
      ),
    );
  }

  @Get('cost')
  @ApiOperation({
    operationId: 'readInsightsCost',
    summary:
      'Spend by harness, model, station and repository, and how it flows from model to station to repository',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsCostResponseDto })
  async cost(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsCostResponseDto> {
    return new InsightsCostResponseDto(
      await this.queryBus.execute<ReadInsightsCostQuery, InsightsCostDto>(
        new ReadInsightsCostQuery(teamId, principal, periodOf(period)),
      ),
    );
  }

  @Get('runs')
  @ApiOperation({
    operationId: 'listInsightsRuns',
    summary:
      'Every run that ended in the period, the newest first, a page at a time; every filter narrows it further',
  })
  @PeriodQuery()
  @FilterQuery('lineId', 'Only runs on this line')
  @FilterQuery('stationId', 'Only runs at this station')
  @ApiQuery({
    name: 'outcome',
    required: false,
    enum: RUN_ENDINGS,
    description: 'Only runs that ended this way',
  })
  @FilterQuery('harness', 'Only runs on this harness')
  @FilterQuery(
    'model',
    `Only runs with this model; ${HARNESS_DEFAULT_MODEL} for runs that named none and took the harness’s own`,
  )
  @FilterQuery(
    'repository',
    `Only runs that worked this repository; ${NO_REPOSITORY} for runs that worked none`,
  )
  @FilterQuery('fingerprint', 'Only runs with this station config')
  @FilterQuery('taskId', 'Only runs of this task')
  @FilterQuery(
    'taskIds',
    `Only runs of these tasks, comma-separated, at most ${MOST_FILTERED_TASKS}`,
  )
  @FilterQuery('personId', 'Only runs of tasks this person opened')
  @FilterQuery('day', 'Only runs that ended on this UTC day, as YYYY-MM-DD')
  @ApiQuery({
    name: 'delivery',
    required: false,
    enum: DELIVERY_STATES,
    description: 'Only runs of tasks whose pull request stands this way',
  })
  @ApiQuery({
    name: 'next',
    required: false,
    enum: PERSON_ACTS,
    description: 'Only runs a person next acted on this way',
  })
  @ApiQuery({
    name: 'asked',
    required: false,
    type: Boolean,
    description:
      'true for only runs of tasks that asked someone in the inbox during the period',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: `Which page, from 1 to the last with runs, ${MOST_RUN_PAGE} at most`,
  })
  @ApiQuery({
    name: 'size',
    required: false,
    type: Number,
    description: 'Runs per page: 50 unless asked, 200 at most',
  })
  @ApiOkResponse({ type: InsightsRunsResponseDto })
  async runs(
    @Param('teamId') teamId: string,
    @Query() asked: Record<string, unknown>,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsRunsResponseDto> {
    return new InsightsRunsResponseDto(
      await this.queryBus.execute<ListInsightsRunsQuery, InsightsRunsDto>(
        new ListInsightsRunsQuery(
          teamId,
          principal,
          periodOf(asked.period),
          {
            lineId: askedOf(asked.lineId),
            stationId: askedOf(asked.stationId),
            outcome: askedOf(asked.outcome),
            harness: askedOf(asked.harness),
            model: askedOf(asked.model),
            repository: askedOf(asked.repository),
            fingerprint: askedOf(asked.fingerprint),
            taskId: askedOf(asked.taskId),
            taskIds: listOf(asked.taskIds),
            personId: askedOf(asked.personId),
            day: askedOf(asked.day),
            delivery: askedOf(asked.delivery),
            next: askedOf(asked.next),
            asked: askedOf(asked.asked),
          },
          numberOf(asked.page),
          numberOf(asked.size),
        ),
      ),
    );
  }
}

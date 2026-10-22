import type {
  InsightsCostDto,
  InsightsFlowDto,
  InsightsOverviewDto,
  InsightsPeopleDto,
  InsightsStationsDto,
} from '@insights/application/dto/insights.dto';
import type {
  InsightsAgentConfigsDto,
  InsightsChangesDto,
} from '@insights/application/dto/insights-changes.dto';
import type { InsightsMemoryDto } from '@insights/application/dto/insights-memory.dto';
import type {
  InsightsPullRequestListDto,
  InsightsPullRequestsDto,
} from '@insights/application/dto/insights-pull-requests.dto';
import type { InsightsShippingDto } from '@insights/application/dto/insights-shipping.dto';
import type { InsightsToolsDto } from '@insights/application/dto/insights-tools.dto';
import type { InsightsTracesDto } from '@insights/application/dto/insights-traces.dto';
import type { StationAlertDto } from '@insights/application/dto/station-alert.dto';
import { ListInsightsPullRequestsQuery } from '@insights/application/queries/list-insights-pull-requests.query';
import { ListInsightsTracesQuery } from '@insights/application/queries/list-insights-traces.query';
import { ReadInsightsAgentConfigsQuery } from '@insights/application/queries/read-insights-agent-configs.query';
import { ReadInsightsChangesQuery } from '@insights/application/queries/read-insights-changes.query';
import { ReadInsightsCostQuery } from '@insights/application/queries/read-insights-cost.query';
import { ReadInsightsFlowQuery } from '@insights/application/queries/read-insights-flow.query';
import { ReadInsightsMemoryQuery } from '@insights/application/queries/read-insights-memory.query';
import { ReadInsightsOverviewQuery } from '@insights/application/queries/read-insights-overview.query';
import { ReadInsightsPeopleQuery } from '@insights/application/queries/read-insights-people.query';
import { ReadInsightsPullRequestsQuery } from '@insights/application/queries/read-insights-pull-requests.query';
import { ReadInsightsShippingQuery } from '@insights/application/queries/read-insights-shipping.query';
import { ReadInsightsStationsQuery } from '@insights/application/queries/read-insights-stations.query';
import { ReadInsightsToolsQuery } from '@insights/application/queries/read-insights-tools.query';
import { ReadStationAlertQuery } from '@insights/application/queries/read-station-alert.query';
import { MAX_FILTERED_REPOSITORIES } from '@insights/domain/services/pull-request-filter';
import {
  HARNESS_DEFAULT_MODEL,
  MAX_FILTERED_TASKS,
  NO_REPOSITORY,
  NO_SERVER,
} from '@insights/domain/services/run-filter';
import { RUN_SIZES } from '@insights/domain/services/run-size';
import {
  PULL_REQUEST_AUTHORS,
  ROUND_BUCKETS,
} from '@insights/domain/services/team-pull-requests';
import { TASK_ACTIONS } from '@insights/domain/value-objects/human-action.vo';
import { INSIGHTS_PERIODS } from '@insights/domain/value-objects/insights-period.vo';
import { PULL_REQUEST_TYPES } from '@insights/domain/value-objects/pull-request-type';
import { RUN_ENDINGS } from '@insights/domain/value-objects/run-ending';
import { TASK_PULL_REQUEST_STATES } from '@insights/domain/value-objects/task-pull-request-state';
import {
  DEFAULT_TRACE_RANGE,
  TRACE_RANGES,
} from '@insights/domain/value-objects/trace-range.vo';
import {
  InsightsAgentConfigsResponseDto,
  InsightsChangesResponseDto,
} from '@insights/presentation/http/dto/insights-changes.response.dto';
import { InsightsCostResponseDto } from '@insights/presentation/http/dto/insights-cost.response.dto';
import { InsightsFlowResponseDto } from '@insights/presentation/http/dto/insights-flow.response.dto';
import { InsightsMemoryResponseDto } from '@insights/presentation/http/dto/insights-memory.response.dto';
import { InsightsOverviewResponseDto } from '@insights/presentation/http/dto/insights-overview.response.dto';
import { InsightsPeopleResponseDto } from '@insights/presentation/http/dto/insights-people.response.dto';
import {
  InsightsPullRequestListResponseDto,
  InsightsPullRequestsResponseDto,
} from '@insights/presentation/http/dto/insights-pull-requests.response.dto';
import { InsightsShippingResponseDto } from '@insights/presentation/http/dto/insights-shipping.response.dto';
import { InsightsStationsResponseDto } from '@insights/presentation/http/dto/insights-stations.response.dto';
import { InsightsToolsResponseDto } from '@insights/presentation/http/dto/insights-tools.response.dto';
import { InsightsTracesResponseDto } from '@insights/presentation/http/dto/insights-traces.response.dto';
import { StationAlertFiringResponseDto } from '@insights/presentation/http/dto/station-alert-firing.response.dto';
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
import { AllowWorkspaceTokens } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const DEFAULT_PERIOD = '30d';

const periodOf = (raw: unknown): string => {
  if (raw === undefined) {
    return DEFAULT_PERIOD;
  }

  return typeof raw === 'string' ? raw : '';
};

const rangeOf = (raw: unknown): string => {
  if (raw === undefined) {
    return DEFAULT_TRACE_RANGE;
  }

  return typeof raw === 'string' ? raw : '';
};

const textOf = (raw: unknown): string | null =>
  typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;

const queryValue = (raw: unknown): string | readonly string[] | null =>
  Array.isArray(raw) ? raw.map(String) : textOf(raw);

const listOf = (raw: unknown): readonly string[] | null => {
  const texts = (Array.isArray(raw) ? raw : [raw]).flatMap((each) => {
    const text = textOf(each);
    return text === null ? [] : text.split(',');
  });
  const listed = texts
    .map((each) => each.trim())
    .filter((each) => each.length > 0);

  return listed.length > 0 ? listed : null;
};

const numberOf = (raw: unknown): number | null => {
  const value = typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isInteger(value) ? value : null;
};

const PeriodQuery = () =>
  ApiQuery({
    name: 'period',
    required: false,
    enum: INSIGHTS_PERIODS,
    description:
      'How many whole UTC days, up to and including today, to look at; 30d by default. Every answer also covers the period before, as long',
  });

const FilterQuery = (name: string, description: string) =>
  ApiQuery({ name, required: false, type: String, description });

@ApiTags('insights')
@ApiBearerAuth()
@AllowWorkspaceTokens()
@ApiUnauthorizedResponse({ description: 'No valid session or token' })
@ApiNotFoundResponse({ description: 'No such team for this caller' })
@ApiUnprocessableEntityResponse({
  description:
    'No such period, or a filter it does not take: more tasks or repositories than it takes, a value longer than it takes, an unknown value, a value repeated where it takes one, a day outside the period, or a page past the last',
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

  @Get('tools')
  @ApiOperation({
    operationId: 'readInsightsTools',
    summary:
      'Which skills the team’s stations enabled for runs and which skills runs read, week by week, and how each MCP server they called behaved',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsToolsResponseDto })
  async tools(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsToolsResponseDto> {
    return new InsightsToolsResponseDto(
      await this.queryBus.execute<ReadInsightsToolsQuery, InsightsToolsDto>(
        new ReadInsightsToolsQuery(teamId, principal, periodOf(period)),
      ),
    );
  }

  @Get('changes')
  @ApiOperation({
    operationId: 'readInsightsChanges',
    summary:
      'Every station config change in the period, with how the station’s runs went before and after it, and the judge’s scores where its judge is qualified',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsChangesResponseDto })
  async changes(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsChangesResponseDto> {
    return new InsightsChangesResponseDto(
      await this.queryBus.execute<ReadInsightsChangesQuery, InsightsChangesDto>(
        new ReadInsightsChangesQuery(teamId, principal, periodOf(period)),
      ),
    );
  }

  @Get('agent-configs')
  @ApiOperation({
    operationId: 'readInsightsAgentConfigs',
    summary:
      'How runs went against what they cost on each harness, model, effort and profile, with the cost frontier marked for each outcome',
  })
  @PeriodQuery()
  @FilterQuery('stationId', 'Only runs at this station')
  @ApiQuery({
    name: 'size',
    required: false,
    enum: RUN_SIZES,
    description:
      'Only runs of this size, told by the lines their changes removed and added, or by their steps where they changed none',
  })
  @ApiOkResponse({ type: InsightsAgentConfigsResponseDto })
  async agentConfigs(
    @Param('teamId') teamId: string,
    @Query() query: Record<string, unknown>,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsAgentConfigsResponseDto> {
    return new InsightsAgentConfigsResponseDto(
      await this.queryBus.execute<
        ReadInsightsAgentConfigsQuery,
        InsightsAgentConfigsDto
      >(
        new ReadInsightsAgentConfigsQuery(
          teamId,
          principal,
          periodOf(query.period),
          textOf(query.stationId),
          textOf(query.size),
        ),
      ),
    );
  }

  @Get('memory')
  @ApiOperation({
    operationId: 'readInsightsMemory',
    summary:
      'The team’s active memories, how many runs were briefed or read them, which were flagged wrong, and how runs with memories went against runs without',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsMemoryResponseDto })
  async memory(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsMemoryResponseDto> {
    return new InsightsMemoryResponseDto(
      await this.queryBus.execute<ReadInsightsMemoryQuery, InsightsMemoryDto>(
        new ReadInsightsMemoryQuery(teamId, principal, periodOf(period)),
      ),
    );
  }

  @Get('alerts/:alertId')
  @ApiOperation({
    operationId: 'readStationAlert',
    summary:
      'A station alert that fired: the rule that fired, the run whose reading fired it, and the measure run by run around it',
  })
  @ApiParam({ name: 'alertId', type: String })
  @ApiOkResponse({ type: StationAlertFiringResponseDto })
  async alert(
    @Param('teamId') teamId: string,
    @Param('alertId') alertId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<StationAlertFiringResponseDto> {
    return new StationAlertFiringResponseDto(
      await this.queryBus.execute<ReadStationAlertQuery, StationAlertDto>(
        new ReadStationAlertQuery(teamId, principal, alertId),
      ),
    );
  }

  @Get('pull-requests')
  @ApiOperation({
    operationId: 'readInsightsPullRequests',
    summary:
      'How much of what the team merges Spotlight authored or reviewed, week by week, how Spotlight’s pull requests fare against people’s, and what kinds it ships',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsPullRequestsResponseDto })
  async pullRequests(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsPullRequestsResponseDto> {
    return new InsightsPullRequestsResponseDto(
      await this.queryBus.execute<
        ReadInsightsPullRequestsQuery,
        InsightsPullRequestsDto
      >(new ReadInsightsPullRequestsQuery(teamId, principal, periodOf(period))),
    );
  }

  @Get('shipping')
  @ApiOperation({
    operationId: 'readInsightsShipping',
    summary:
      'How fast what Spotlight makes ships against what people make alone: time to merge by day and kind, review depth by week, time to first review, review bots, and how long merged pull requests spent at each stage',
  })
  @PeriodQuery()
  @ApiOkResponse({ type: InsightsShippingResponseDto })
  async shipping(
    @Param('teamId') teamId: string,
    @Query('period') period: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsShippingResponseDto> {
    return new InsightsShippingResponseDto(
      await this.queryBus.execute<
        ReadInsightsShippingQuery,
        InsightsShippingDto
      >(new ReadInsightsShippingQuery(teamId, principal, periodOf(period))),
    );
  }

  @Get('pull-requests/list')
  @ApiOperation({
    operationId: 'listInsightsPullRequests',
    summary:
      'Every pull request in the team’s repositories opened or closed in the period, or still open, the latest first, a page at a time; every filter narrows it further',
  })
  @PeriodQuery()
  @FilterQuery(
    'repository',
    `Only pull requests in these repositories, comma-separated or repeated, at most ${MAX_FILTERED_REPOSITORIES}`,
  )
  @ApiQuery({
    name: 'author',
    required: false,
    enum: PULL_REQUEST_AUTHORS,
    description:
      'spotlight for those a task opened, reviewed for others’ a Spotlight review task was opened on, bots for bots’ with no such task, people for the rest',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: PULL_REQUEST_TYPES,
    description: 'Only pull requests of this type',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: TASK_PULL_REQUEST_STATES,
    description:
      'merged or closed for those that closed so in the period, open for those still open',
  })
  @FilterQuery(
    'week',
    'Only pull requests that closed in the week starting this UTC day, as YYYY-MM-DD',
  )
  @ApiQuery({
    name: 'reverted',
    required: false,
    type: Boolean,
    description:
      'true for only pull requests another merged pull request reverted',
  })
  @ApiQuery({
    name: 'compared',
    required: false,
    type: Boolean,
    description:
      'true for only pull requests in the repositories Spotlight merged into in the period, the ones its pull requests are set against people’s in',
  })
  @ApiQuery({
    name: 'rounds',
    required: false,
    enum: ROUND_BUCKETS,
    description: 'Only pull requests that needed this many review rounds',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Which page, from 1',
  })
  @ApiQuery({
    name: 'size',
    required: false,
    type: Number,
    description: 'Pull requests per page: 50 by default, 200 at most',
  })
  @ApiOkResponse({ type: InsightsPullRequestListResponseDto })
  async pullRequestList(
    @Param('teamId') teamId: string,
    @Query() query: Record<string, unknown>,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsPullRequestListResponseDto> {
    return new InsightsPullRequestListResponseDto(
      await this.queryBus.execute<
        ListInsightsPullRequestsQuery,
        InsightsPullRequestListDto
      >(
        new ListInsightsPullRequestsQuery(
          teamId,
          principal,
          periodOf(query.period),
          {
            repository: listOf(query.repository),
            author: queryValue(query.author),
            type: queryValue(query.type),
            state: queryValue(query.state),
            week: queryValue(query.week),
            reverted: queryValue(query.reverted),
            rounds: queryValue(query.rounds),
            compared: queryValue(query.compared),
          },
          numberOf(query.page),
          numberOf(query.size),
        ),
      ),
    );
  }

  @Get('traces')
  @ApiOperation({
    operationId: 'listInsightsTraces',
    summary:
      'Every task with a run in the range, as one trace each, with the runs that match the filter',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: TRACE_RANGES,
    example: '7d',
    description: `How far back from now to look, counting runs that ended since; ${DEFAULT_TRACE_RANGE} by default`,
  })
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
    `Only runs with this model; ${HARNESS_DEFAULT_MODEL} for runs that named none and used the harness’s own`,
  )
  @FilterQuery(
    'repository',
    `Only runs that worked this repository; ${NO_REPOSITORY} for runs that worked none`,
  )
  @FilterQuery('fingerprint', 'Only runs with this station config')
  @FilterQuery('taskId', 'Only runs of this task')
  @FilterQuery(
    'taskIds',
    `Only runs of these tasks, comma-separated, at most ${MAX_FILTERED_TASKS}`,
  )
  @FilterQuery('personId', 'Only runs of tasks this person opened')
  @FilterQuery('day', 'Only runs that ended on this UTC day, as YYYY-MM-DD')
  @FilterQuery(
    'week',
    'Only runs that ended in the week starting this UTC Monday, as YYYY-MM-DD',
  )
  @FilterQuery(
    'skillEnabled',
    'Only runs whose station config enabled this skill',
  )
  @FilterQuery('skillUsed', 'Only runs that read this skill')
  @FilterQuery('server', 'Only runs that called this MCP server')
  @FilterQuery(
    'serverFailed',
    'Only runs with a call to this MCP server that failed',
  )
  @FilterQuery(
    'failedAfter',
    'Only runs that failed where the run’s last call to this MCP server failed',
  )
  @FilterQuery(
    'dismissedTool',
    'Only runs in which a person dismissed an approval for this tool',
  )
  @FilterQuery(
    'dismissedServer',
    `Only runs in which a person dismissed an approval for a tool of this MCP server; ${NO_SERVER} for tools of no server`,
  )
  @ApiQuery({
    name: 'pullRequestState',
    required: false,
    enum: TASK_PULL_REQUEST_STATES,
    description: 'Only runs of tasks whose pull request has this status',
  })
  @ApiQuery({
    name: 'humanAction',
    required: false,
    enum: TASK_ACTIONS,
    description: 'Only runs that a person acted on first in this way',
  })
  @ApiQuery({
    name: 'asked',
    required: false,
    type: Boolean,
    description:
      'true for only runs of tasks that asked someone in the inbox during the period',
  })
  @ApiOkResponse({ type: InsightsTracesResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'No such range, or a filter that is not valid',
  })
  async traces(
    @Param('teamId') teamId: string,
    @Query() query: Record<string, unknown>,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InsightsTracesResponseDto> {
    return new InsightsTracesResponseDto(
      await this.queryBus.execute<ListInsightsTracesQuery, InsightsTracesDto>(
        new ListInsightsTracesQuery(teamId, principal, rangeOf(query.range), {
          lineId: queryValue(query.lineId),
          stationId: queryValue(query.stationId),
          outcome: queryValue(query.outcome),
          harness: queryValue(query.harness),
          model: queryValue(query.model),
          repository: queryValue(query.repository),
          fingerprint: queryValue(query.fingerprint),
          taskId: queryValue(query.taskId),
          taskIds: listOf(query.taskIds),
          personId: queryValue(query.personId),
          day: queryValue(query.day),
          week: queryValue(query.week),
          skillEnabled: queryValue(query.skillEnabled),
          skillUsed: queryValue(query.skillUsed),
          server: queryValue(query.server),
          serverFailed: queryValue(query.serverFailed),
          failedAfter: queryValue(query.failedAfter),
          dismissedTool: queryValue(query.dismissedTool),
          dismissedServer: queryValue(query.dismissedServer),
          pullRequestState: queryValue(query.pullRequestState),
          humanAction: queryValue(query.humanAction),
          asked: queryValue(query.asked),
        }),
      ),
    );
  }
}

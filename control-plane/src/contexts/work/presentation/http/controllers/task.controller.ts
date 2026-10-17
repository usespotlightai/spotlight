import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import { AddTaskCommand } from '@work/application/commands/add-task.command';
import { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import { MoveTaskCommand } from '@work/application/commands/move-task.command';
import { SayToRunCommand } from '@work/application/commands/say-to-run.command';
import { StopRunCommand } from '@work/application/commands/stop-run.command';
import type { RunConfigDto } from '@work/application/dto/run-config.dto';
import type { RunConversationDto } from '@work/application/dto/run-conversation.dto';
import type { RunNetworkDto } from '@work/application/dto/run-network.dto';
import type { TaskDto } from '@work/application/dto/task.dto';
import type {
  TaskRunDto,
  TeamRunDto,
} from '@work/application/dto/task-run.dto';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import type { TeamTracesDto } from '@work/application/dto/team-trace.dto';
import { ListTaskRunsQuery } from '@work/application/queries/list-task-runs.query';
import { ListTasksQuery } from '@work/application/queries/list-tasks.query';
import { ListTeamRunsQuery } from '@work/application/queries/list-team-runs.query';
import { ListTeamTracesQuery } from '@work/application/queries/list-team-traces.query';
import { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import { ReadRunConversationQuery } from '@work/application/queries/read-run-conversation.query';
import { ReadRunNetworkQuery } from '@work/application/queries/read-run-network.query';
import { ReadTaskTraceQuery } from '@work/application/queries/read-task-trace.query';
import {
  DEFAULT_TRACE_RANGE,
  TRACE_RANGES,
} from '@work/domain/value-objects/trace-range.vo';
import { AddTaskRequestDto } from '@work/presentation/http/dto/add-task.request.dto';
import { AssignTaskRequestDto } from '@work/presentation/http/dto/assign-task.request.dto';
import {
  InboxApprovalResponseDto,
  InboxAuthorResponseDto,
  InboxConnectionResponseDto,
  InboxFailureResponseDto,
  InboxMessageResponseDto,
} from '@work/presentation/http/dto/inbox.response.dto';
import { MoveTaskRequestDto } from '@work/presentation/http/dto/move-task.request.dto';
import { RunConfigResponseDto } from '@work/presentation/http/dto/run-config.response.dto';
import { RunNetworkResponseDto } from '@work/presentation/http/dto/run-network.response.dto';
import { TaskResponseDto } from '@work/presentation/http/dto/task.response.dto';
import {
  RunConversationResponseDto,
  RunSpendResponseDto,
  RunStationResponseDto,
  SayToRunRequestDto,
  TaskRunResponseDto,
  TeamRunResponseDto,
} from '@work/presentation/http/dto/task-run.response.dto';
import { TaskTraceResponseDto } from '@work/presentation/http/dto/task-trace.response.dto';
import { TeamTracesResponseDto } from '@work/presentation/http/dto/team-trace.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';
import { givenIds } from '@work/presentation/http/mappers/given-ids';
import { TaskHttpMapper } from '@work/presentation/http/mappers/task.http.mapper';
import { TaskRunHttpMapper } from '@work/presentation/http/mappers/task-run.http.mapper';
import { TaskTraceHttpMapper } from '@work/presentation/http/mappers/task-trace.http.mapper';
import { TeamTraceHttpMapper } from '@work/presentation/http/mappers/team-trace.http.mapper';

const rangeOf = (raw: unknown): string => {
  if (raw === undefined) {
    return DEFAULT_TRACE_RANGE;
  }

  return typeof raw === 'string' ? raw : '';
};

@ApiTags('tasks')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({
  name: 'teamId',
  type: String,
  example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
})
@Controller('teams/:teamId')
export class TaskController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('tasks')
  @ApiOperation({
    operationId: 'listTasks',
    summary: 'List the tasks standing at a team’s stations, oldest first',
  })
  @ApiOkResponse({ type: TaskResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskResponseDto[]> {
    const tasks = await this.queryBus.execute<ListTasksQuery, TaskDto[] | null>(
      new ListTasksQuery(teamId, user.id),
    );

    if (!tasks) {
      throw new NotFoundException();
    }

    return tasks.map(TaskHttpMapper.toResponse);
  }

  @Get('runs')
  @ApiOperation({
    operationId: 'listTeamRuns',
    summary: 'Every run the team has worked, across its stations',
  })
  @ApiOkResponse({ type: TeamRunResponseDto, isArray: true })
  async teamRuns(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamRunResponseDto[]> {
    const runs = await this.queryBus.execute<ListTeamRunsQuery, TeamRunDto[]>(
      new ListTeamRunsQuery(teamId, user.id),
    );

    return runs.map(TaskRunHttpMapper.teamToResponse);
  }

  @Get('traces')
  @ApiOperation({
    operationId: 'listTeamTraces',
    summary: 'Every task the team has worked, as one trace each',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: TRACE_RANGES,
    example: '7d',
    description:
      'How far back from now to look, counting runs started since; 30d unless asked',
  })
  @ApiOkResponse({ type: TeamTracesResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'No such range' })
  async teamTraces(
    @Param('teamId') teamId: string,
    @Query('range') range: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamTracesResponseDto> {
    const traces = await this.queryBus.execute<
      ListTeamTracesQuery,
      TeamTracesDto
    >(new ListTeamTracesQuery(teamId, user.id, rangeOf(range)));

    return TeamTraceHttpMapper.toTracesResponse(traces);
  }

  @Get('runs/:runId/config')
  @ApiOperation({
    operationId: 'readRunConfig',
    summary:
      'The station config a run ran with, and what changed since the station’s run before it',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: RunConfigResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async config(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunConfigResponseDto> {
    const found = await this.queryBus.execute<
      ReadRunConfigQuery,
      RunConfigDto | null
    >(new ReadRunConfigQuery(teamId, runId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new RunConfigResponseDto(found);
  }

  @Get('runs/:runId/network')
  @ApiOperation({
    operationId: 'readRunNetwork',
    summary:
      'The connections a run made through a shared egress, and if egress was enforced',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: RunNetworkResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async network(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunNetworkResponseDto> {
    const found = await this.queryBus.execute<
      ReadRunNetworkQuery,
      RunNetworkDto | null
    >(new ReadRunNetworkQuery(runId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new RunNetworkResponseDto(found);
  }

  @Get('runs/:runId/conversation')
  @ApiOperation({
    operationId: 'readRunConversation',
    summary: 'The task and the trail since it reached this run’s station',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: RunConversationResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async conversation(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunConversationResponseDto> {
    const found = await this.queryBus.execute<
      ReadRunConversationQuery,
      RunConversationDto | null
    >(new ReadRunConversationQuery(runId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new RunConversationResponseDto(
      found.runId,
      found.taskId,
      found.title,
      found.description,
      found.attachments.map(AttachmentHttpMapper.toResponse),
      found.station
        ? new RunStationResponseDto(
            found.station.id,
            found.station.name,
            found.station.color,
            found.station.position,
            found.station.count,
          )
        : null,
      found.createdAt,
      found.briefing,
      found.working,
      found.notes.map(
        (note) =>
          new InboxMessageResponseDto(
            note.position,
            note.kind,
            note.form,
            note.voice,
            note.station,
            note.stationColor,
            note.stationPosition,
            note.runId,
            note.body,
            note.attachments.map(AttachmentHttpMapper.toResponse),
            note.at,
            note.author
              ? new InboxAuthorResponseDto(
                  note.author.id,
                  note.author.name,
                  note.author.image,
                )
              : null,
            note.approval ? new InboxApprovalResponseDto(note.approval) : null,
            note.failure ? new InboxFailureResponseDto(note.failure) : null,
            note.connection
              ? new InboxConnectionResponseDto(note.connection)
              : null,
          ),
      ),
      found.spend
        ? new RunSpendResponseDto(
            found.spend.cost,
            found.spend.currency,
            found.spend.inputTokens,
            found.spend.outputTokens,
            found.spend.cacheReadTokens,
            found.spend.cacheWriteTokens,
          )
        : null,
    );
  }

  @Post('runs/:runId/say')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'sayToRun',
    summary: 'Say something to the agent working a run',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiNoContentResponse({
    description:
      'It joined the task’s trail, and starts the station again if the task stood idle there',
  })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiConflictResponse({
    description: 'The task has moved on from that station',
  })
  async say(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SayToRunRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new SayToRunCommand(
        runId,
        user.id,
        body.body ?? '',
        givenIds(body.attachments),
      ),
    );
  }

  @Post('runs/:runId/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'stopRun',
    summary: 'Stop the agent working a run',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiNoContentResponse({ description: 'The run was asked to stop' })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiConflictResponse({ description: 'The run is no longer being worked' })
  async stop(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new StopRunCommand(runId, user.id));
  }

  @Get('tasks/:taskId/runs')
  @ApiOperation({
    operationId: 'listTaskRuns',
    summary: 'List what has been run on a task, most recent first',
  })
  @ApiParam({ name: 'taskId' })
  @ApiOkResponse({ type: TaskRunResponseDto, isArray: true })
  async runs(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskRunResponseDto[]> {
    const runs = await this.queryBus.execute<ListTaskRunsQuery, TaskRunDto[]>(
      new ListTaskRunsQuery(taskId, user.id),
    );

    return runs.map(TaskRunHttpMapper.toResponse);
  }

  @Get('tasks/:taskId/trace')
  @ApiOperation({
    operationId: 'readTaskTrace',
    summary: 'Every run that worked a task, as one trace',
  })
  @ApiParam({ name: 'taskId' })
  @ApiOkResponse({ type: TaskTraceResponseDto })
  @ApiNotFoundResponse({ description: "No such task, or not the viewer's" })
  async trace(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskTraceResponseDto> {
    const trace = await this.queryBus.execute<
      ReadTaskTraceQuery,
      TaskTraceDto | null
    >(new ReadTaskTraceQuery(taskId, user.id));

    if (!trace) {
      throw new NotFoundException(`Task ${taskId} not found.`);
    }

    return TaskTraceHttpMapper.toResponse(trace);
  }

  @Delete('tasks/:taskId')
  @ApiOperation({
    operationId: 'deleteTask',
    summary: 'Delete a task',
  })
  @ApiParam({
    name: 'taskId',
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13',
  })
  @ApiNoContentResponse({ description: 'The task is gone' })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute<DeleteTaskCommand, void>(
      new DeleteTaskCommand(teamId, taskId, user.id),
    );
  }

  @Post('lines/:lineId/stations/:stationId/tasks')
  @ApiOperation({
    operationId: 'addTask',
    summary: 'Add a task to a station',
  })
  @ApiParam({ name: 'lineId', example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  @ApiParam({
    name: 'stationId',
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
  })
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'No such station for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid title or description',
  })
  async add(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Body() body: AddTaskRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    const added = await this.commandBus.execute<AddTaskCommand, TaskDto>(
      new AddTaskCommand(
        teamId,
        lineId,
        stationId,
        body.title,
        body.description ?? null,
        user.id,
        givenIds(body.attachments),
      ),
    );

    return TaskHttpMapper.toResponse(added);
  }

  @Post('lines/:lineId/tasks/:taskId/move')
  @ApiOperation({
    operationId: 'moveTask',
    summary: 'Move a task to another station on the same line',
  })
  @ApiParam({ name: 'lineId', example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  @ApiParam({
    name: 'taskId',
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({
    description: 'No such task or station for this caller',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'A person may only start a task from the backlog, park it back there, or close it',
  })
  @HttpCode(HttpStatus.OK)
  async move(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('taskId') taskId: string,
    @Body() body: MoveTaskRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    const moved = await this.commandBus.execute<MoveTaskCommand, TaskDto>(
      new MoveTaskCommand(
        teamId,
        lineId,
        taskId,
        body.stationId,
        body.revision,
        body.afterTaskId ?? null,
        user.id,
      ),
    );

    return TaskHttpMapper.toResponse(moved);
  }

  @Put('tasks/:taskId/assignee')
  @ApiOperation({
    operationId: 'assignTask',
    summary: 'Give a task to a team member, or clear its assignee',
  })
  @ApiParam({
    name: 'taskId',
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  @HttpCode(HttpStatus.OK)
  async assign(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Body() body: AssignTaskRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    const assigned = await this.commandBus.execute<AssignTaskCommand, TaskDto>(
      new AssignTaskCommand(teamId, taskId, body.assigneeId ?? null, user.id),
    );

    return TaskHttpMapper.toResponse(assigned);
  }
}

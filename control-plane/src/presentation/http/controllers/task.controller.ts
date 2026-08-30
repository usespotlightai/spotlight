import { AddTaskCommand } from '@application/commands/add-task.command';
import { DeleteTaskCommand } from '@application/commands/delete-task.command';
import { MoveTaskCommand } from '@application/commands/move-task.command';
import { SayToRunCommand } from '@application/commands/say-to-run.command';
import type { StationDto } from '@application/dto/assembly-line.dto';
import type { RunConversationDto } from '@application/dto/run-conversation.dto';
import type { TaskDto } from '@application/dto/task.dto';
import type { TaskRunDto, TeamRunDto } from '@application/dto/task-run.dto';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { FindStationQuery } from '@application/queries/find-station.query';
import { ListTaskRunsQuery } from '@application/queries/list-task-runs.query';
import { ListTasksQuery } from '@application/queries/list-tasks.query';
import { ListTeamRunsQuery } from '@application/queries/list-team-runs.query';
import { ReadRunConversationQuery } from '@application/queries/read-run-conversation.query';
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
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { AddTaskRequestDto } from '@presentation/http/dto/add-task.request.dto';
import {
  InboxAuthorResponseDto,
  InboxMessageResponseDto,
} from '@presentation/http/dto/inbox.response.dto';
import { MoveTaskRequestDto } from '@presentation/http/dto/move-task.request.dto';
import { TaskResponseDto } from '@presentation/http/dto/task.response.dto';
import {
  RunConversationResponseDto,
  RunStationResponseDto,
  SayToRunRequestDto,
  TaskRunResponseDto,
  TeamRunResponseDto,
} from '@presentation/http/dto/task-run.response.dto';
import { TaskHttpMapper } from '@presentation/http/mappers/task.http.mapper';
import { TaskRunHttpMapper } from '@presentation/http/mappers/task-run.http.mapper';

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
      found.station
        ? new RunStationResponseDto(
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
            note.station,
            note.stationColor,
            note.stationPosition,
            note.runId,
            note.body,
            note.at,
            note.author
              ? new InboxAuthorResponseDto(
                  note.author.id,
                  note.author.name,
                  note.author.image,
                )
              : null,
          ),
      ),
    );
  }

  @Post('runs/:runId/say')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'sayToRun',
    summary: 'Say something to the agent working a run',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiNoContentResponse({ description: 'It joined the task’s trail' })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'The task has moved on from that station',
  })
  async say(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SayToRunRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new SayToRunCommand(runId, user.id, body.body),
    );
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
    const tasks = await this.queryBus.execute<ListTasksQuery, TaskDto[] | null>(
      new ListTasksQuery(teamId, user.id),
    );

    if (!tasks?.some((each) => each.id === taskId)) {
      throw new NotFoundException();
    }

    await this.commandBus.execute<DeleteTaskCommand, void>(
      new DeleteTaskCommand(taskId),
    );
  }

  @Post('assembly-lines/:lineId/stations/:stationId/tasks')
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
    const visible = await this.queryBus.execute<
      FindStationQuery,
      StationDto | null
    >(new FindStationQuery(teamId, lineId, stationId, user.id));

    if (!visible) {
      throw new NotFoundException();
    }

    const added = await this.commandBus.execute<AddTaskCommand, TaskDto>(
      new AddTaskCommand(
        lineId,
        stationId,
        body.title,
        body.description ?? null,
        user.id,
        body.repository ?? null,
      ),
    );

    return TaskHttpMapper.toResponse(added);
  }

  @Post('assembly-lines/:lineId/tasks/:taskId/move')
  @ApiOperation({
    operationId: 'moveTask',
    summary: 'Move a task to another station on the same assembly line',
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
  @HttpCode(HttpStatus.OK)
  async move(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('taskId') taskId: string,
    @Body() body: MoveTaskRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    const visible = await this.queryBus.execute<
      FindStationQuery,
      StationDto | null
    >(new FindStationQuery(teamId, lineId, body.stationId, user.id));

    if (!visible) {
      throw new NotFoundException();
    }

    const moved = await this.commandBus.execute<MoveTaskCommand, TaskDto>(
      new MoveTaskCommand(
        lineId,
        taskId,
        body.stationId,
        body.afterTaskId ?? null,
      ),
    );

    return TaskHttpMapper.toResponse(moved);
  }
}

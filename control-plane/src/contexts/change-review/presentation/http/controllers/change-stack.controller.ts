import type {
  LatestChangeStackDto,
  RunChangeStacksDto,
} from '@change-review/application/dto/change-stack.dto';
import { ListRunChangeStacksQuery } from '@change-review/application/queries/list-run-change-stacks.query';
import { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import {
  LatestChangeStackResponseDto,
  RunChangeStacksResponseDto,
  TaskChangeStackResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';
import { ChangeStackHttpMapper } from '@change-review/presentation/http/mappers/change-stack.http.mapper';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('change-stacks')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@Controller('teams/:teamId')
export class ChangeStackController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('runs/:runId/change-stacks')
  @ApiOperation({
    operationId: 'listRunChangeStacks',
    summary: 'The change stacks drafted of what a run changed, newest first',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: RunChangeStacksResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async changeStacks(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunChangeStacksResponseDto> {
    const found = await this.queryBus.execute<
      ListRunChangeStacksQuery,
      RunChangeStacksDto | null
    >(new ListRunChangeStacksQuery(runId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return ChangeStackHttpMapper.toResponse(found);
  }

  @Get('tasks/:taskId/change-stack')
  @ApiOperation({
    operationId: 'readTaskChangeStack',
    summary: 'The newest change stack drafted for a task',
  })
  @ApiParam({ name: 'taskId', type: String })
  @ApiOkResponse({ type: TaskChangeStackResponseDto })
  async taskChangeStack(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskChangeStackResponseDto> {
    const latest = await this.queryBus.execute<
      ReadTaskChangeStackQuery,
      LatestChangeStackDto | null
    >(new ReadTaskChangeStackQuery(taskId, user.id));

    return new TaskChangeStackResponseDto(
      latest &&
        new LatestChangeStackResponseDto(
          latest.runId,
          latest.repository,
          latest.state,
          latest.checkState,
        ),
    );
  }
}

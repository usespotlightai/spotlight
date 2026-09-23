import { DisputeDecisionCommand } from '@change-review/application/commands/dispute-decision.command';
import type { TaskDecisionsDto } from '@change-review/application/dto/decision.dto';
import { ReadTaskDecisionsQuery } from '@change-review/application/queries/read-task-decisions.query';
import {
  DisputeDecisionRequestDto,
  TaskDecisionsResponseDto,
} from '@change-review/presentation/http/dto/decision.response.dto';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('decisions')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@Controller('teams/:teamId')
export class DecisionController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('tasks/:taskId/decisions')
  @ApiOperation({
    operationId: 'readTaskDecisions',
    summary:
      'The decisions the agent made in the task’s latest drafted run, for review',
  })
  @ApiParam({ name: 'taskId', type: String })
  @ApiOkResponse({ type: TaskDecisionsResponseDto })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async taskDecisions(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskDecisionsResponseDto> {
    const found = await this.queryBus.execute<
      ReadTaskDecisionsQuery,
      TaskDecisionsDto | null
    >(new ReadTaskDecisionsQuery(teamId, taskId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new TaskDecisionsResponseDto(found);
  }

  @Post('tasks/:taskId/decisions/:decisionId/disputes')
  @ApiOperation({
    operationId: 'disputeDecision',
    summary: 'Say a decision the agent made is wrong or out of date, and why',
  })
  @ApiParam({ name: 'taskId', type: String })
  @ApiParam({ name: 'decisionId', type: String })
  @ApiBody({ type: DisputeDecisionRequestDto })
  @ApiCreatedResponse({ type: TaskDecisionsResponseDto })
  @ApiBadRequestResponse({
    description:
      'No reason given, one too long, or a path the decision does not name',
  })
  @ApiNotFoundResponse({ description: 'No such decision for this caller' })
  async dispute(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('decisionId') decisionId: string,
    @Body() body: DisputeDecisionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskDecisionsResponseDto> {
    const found = await this.commandBus.execute<
      DisputeDecisionCommand,
      TaskDecisionsDto
    >(
      new DisputeDecisionCommand(
        teamId,
        taskId,
        decisionId,
        body.path ?? '',
        user.id,
        body.reason ?? '',
      ),
    );

    return new TaskDecisionsResponseDto(found);
  }
}

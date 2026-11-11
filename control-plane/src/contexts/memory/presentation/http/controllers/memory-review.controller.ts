import { ApproveMemoriesCommand } from '@memory/application/commands/approve-memories.command';
import { RejectMemoryCommand } from '@memory/application/commands/reject-memory.command';
import type { MemoryReviewDto } from '@memory/application/dto/memory-review.dto';
import { ReadMemoryReviewQuery } from '@memory/application/queries/read-memory-review.query';
import {
  ApproveMemoriesRequestDto,
  type ApprovedMemoryRequestDto,
  MemoryReviewResponseDto,
} from '@memory/presentation/http/dto/memory-review.response.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

const approvedIn = (body: ApproveMemoriesRequestDto | undefined) =>
  (Array.isArray(body?.memories) ? body.memories : []).map(
    (each: ApprovedMemoryRequestDto | undefined) => ({
      id: typeof each?.id === 'string' ? each.id : '',
      ...(typeof each?.body === 'string' ? { body: each.body } : {}),
    }),
  );

@ApiTags('memories')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'taskId', type: String })
@ApiParam({ name: 'runId', type: String })
@Controller('teams/:teamId/tasks/:taskId/runs/:runId/memories')
export class MemoryReviewController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readMemoryReview',
    summary:
      'The memories a run proposed for the team to approve, each with what it cites',
  })
  @ApiOkResponse({ type: MemoryReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async review(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryReviewResponseDto> {
    return this.reviewOf(teamId, taskId, runId, user.id);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'approveMemories',
    summary:
      'Make proposed memories active, as proposed or as edited, and keep what they cite',
  })
  @ApiBody({ type: ApproveMemoriesRequestDto })
  @ApiOkResponse({ type: MemoryReviewResponseDto })
  @ApiUnprocessableEntityResponse({
    description:
      'No memories named, one named twice, an edit too long, or one from outside the team approved with others',
  })
  @ApiNotFoundResponse({ description: 'No such memory for this caller' })
  @ApiConflictResponse({
    description: 'It was decided or redrafted meanwhile',
  })
  async approve(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('runId') runId: string,
    @Body() body: ApproveMemoriesRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryReviewResponseDto> {
    await this.commandBus.execute<ApproveMemoriesCommand, void>(
      new ApproveMemoriesCommand(
        teamId,
        taskId,
        runId,
        approvedIn(body),
        user.id,
      ),
    );

    return this.reviewOf(teamId, taskId, runId, user.id);
  }

  @Post(':memoryId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'rejectMemory',
    summary:
      'Turn a proposed memory down; it stays stored, never briefed, and not proposed again',
  })
  @ApiParam({ name: 'memoryId', type: String })
  @ApiOkResponse({ type: MemoryReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such memory for this caller' })
  @ApiConflictResponse({
    description: 'It was decided or redrafted meanwhile',
  })
  async reject(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('runId') runId: string,
    @Param('memoryId') memoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryReviewResponseDto> {
    await this.commandBus.execute<RejectMemoryCommand, void>(
      new RejectMemoryCommand(teamId, taskId, runId, memoryId, user.id),
    );

    return this.reviewOf(teamId, taskId, runId, user.id);
  }

  private async reviewOf(
    teamId: string,
    taskId: string,
    runId: string,
    viewerId: string,
  ): Promise<MemoryReviewResponseDto> {
    const found = await this.queryBus.execute<
      ReadMemoryReviewQuery,
      MemoryReviewDto | null
    >(new ReadMemoryReviewQuery(teamId, taskId, runId, viewerId));

    if (!found) {
      throw new NotFoundException(
        `Run ${runId} of task ${taskId} has no memories to review.`,
      );
    }

    return new MemoryReviewResponseDto(found);
  }
}

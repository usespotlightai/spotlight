import { ApproveMemoriesCommand } from '@memory/application/commands/approve-memories.command';
import { RejectMemoryCommand } from '@memory/application/commands/reject-memory.command';
import type { MemoryReviewDto } from '@memory/application/dto/memory-review.dto';
import { ReadMemoryReviewQuery } from '@memory/application/queries/read-memory-review.query';
import {
  ApproveMemoriesRequestDto,
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
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const approvedIn = (body: ApproveMemoriesRequestDto | undefined) =>
  (Array.isArray(body?.memories) ? body.memories : []).map((each) => ({
    id: typeof each?.id === 'string' ? each.id : '',
    ...(typeof each?.body === 'string' ? { body: each.body } : {}),
  }));

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
      'The memories a run proposed for the team to keep, each with what it rests on',
  })
  @ApiOkResponse({ type: MemoryReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async review(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryReviewResponseDto> {
    const found = await this.queryBus.execute<
      ReadMemoryReviewQuery,
      MemoryReviewDto | null
    >(new ReadMemoryReviewQuery(teamId, taskId, runId, user.id));

    if (!found) {
      throw new NotFoundException(
        `Run ${runId} of task ${taskId} has no memories to review.`,
      );
    }

    return new MemoryReviewResponseDto(found);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'approveMemories',
    summary:
      'Let proposed memories stand, as proposed or as edited, keeping what they rest on',
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
    return new MemoryReviewResponseDto(
      await this.commandBus.execute<ApproveMemoriesCommand, MemoryReviewDto>(
        new ApproveMemoriesCommand(
          teamId,
          taskId,
          runId,
          approvedIn(body),
          user.id,
        ),
      ),
    );
  }

  @Post(':memoryId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'rejectMemory',
    summary:
      'Turn a proposed memory down; it is kept, never briefed, and not proposed again',
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
    return new MemoryReviewResponseDto(
      await this.commandBus.execute<RejectMemoryCommand, MemoryReviewDto>(
        new RejectMemoryCommand(teamId, taskId, runId, memoryId, user.id),
      ),
    );
  }
}

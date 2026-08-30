import { AnswerTaskCommand } from '@application/commands/answer-task.command';
import type { InboxItemDto } from '@application/dto/inbox.dto';
import type { RunJournal } from '@application/ports/run-journal-reader.port';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { ListInboxQuery } from '@application/queries/list-inbox.query';
import { ReadTaskJournalQuery } from '@application/queries/read-task-journal.query';
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import {
  AnswerInboxItemRequestDto,
  InboxAuthorResponseDto,
  InboxItemResponseDto,
  InboxMessageResponseDto,
  InboxRaisedAtResponseDto,
  JournalStepResponseDto,
  RunJournalResponseDto,
  RunSpentResponseDto,
} from '@presentation/http/dto/inbox.response.dto';

@ApiTags('inbox')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/inbox')
export class InboxController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listInbox',
    summary: 'The tasks waiting on a person, newest first',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: InboxItemResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InboxItemResponseDto[]> {
    const waiting = await this.queryBus.execute<
      ListInboxQuery,
      InboxItemDto[] | null
    >(new ListInboxQuery(slug, user.id));

    if (!waiting) {
      throw new NotFoundException();
    }

    return waiting.map(
      (item) =>
        new InboxItemResponseDto(
          item.id,
          item.taskId,
          item.teamId,
          item.title,
          item.description,
          item.station,
          item.stationColor,
          item.stationPosition,
          item.stationCount,
          new InboxRaisedAtResponseDto(
            item.raisedAt.station,
            item.raisedAt.stationColor,
            item.raisedAt.stationPosition,
          ),
          item.createdAt,
          item.askedAt,
          item.resolved,
          item.working,
          item.notes.map(
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
        ),
    );
  }

  @Post(':taskId/answer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'answerInboxItem',
    summary: 'Answer what a task is waiting on, and let the work carry on',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'taskId' })
  @ApiNoContentResponse({ description: 'The answer was recorded' })
  async answer(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AnswerInboxItemRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AnswerTaskCommand(taskId, user.id, body.body),
    );
  }

  @Get(':taskId/journal')
  @ApiOperation({
    operationId: 'readTaskJournal',
    summary: 'What each run did to arrive at what it said',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'taskId' })
  @ApiOkResponse({ type: RunJournalResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async journal(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunJournalResponseDto[]> {
    const worked = await this.queryBus.execute<
      ReadTaskJournalQuery,
      RunJournal[] | null
    >(new ReadTaskJournalQuery(taskId, user.id));

    if (!worked) {
      throw new NotFoundException();
    }

    return worked.map(
      (each) =>
        new RunJournalResponseDto(
          each.runId,
          each.attempt,
          each.steps.map(
            (step) =>
              new JournalStepResponseDto(
                step.kind,
                step.text,
                step.status,
                step.tool,
                step.detail,
                step.ms,
              ),
          ),
          each.ms,
          each.spent
            ? new RunSpentResponseDto(
                each.spent.used,
                each.spent.size,
                each.spent.cost,
                each.spent.currency,
              )
            : null,
          each.readable,
        ),
    );
  }
}

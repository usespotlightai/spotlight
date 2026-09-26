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
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import { AnswerInboxItemCommand } from '@work/application/commands/answer-inbox-item.command';
import { ReadInboxItemCommand } from '@work/application/commands/read-inbox-item.command';
import type { InboxItemDto } from '@work/application/dto/inbox.dto';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import { ListInboxQuery } from '@work/application/queries/list-inbox.query';
import { ReadTaskJournalQuery } from '@work/application/queries/read-task-journal.query';
import {
  AnswerInboxItemRequestDto,
  InboxApprovalResponseDto,
  InboxAuthorResponseDto,
  InboxFailureResponseDto,
  InboxItemResponseDto,
  InboxMessageResponseDto,
  InboxStationResponseDto,
} from '@work/presentation/http/dto/inbox.response.dto';
import { RunJournalResponseDto } from '@work/presentation/http/dto/run-journal.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';
import { RunJournalHttpMapper } from '@work/presentation/http/mappers/run-journal.http.mapper';

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
          item.attachments.map(AttachmentHttpMapper.toResponse),
          item.station,
          item.stationColor,
          item.stationPosition,
          item.stationCount,
          new InboxStationResponseDto(
            item.raisedAt.name,
            item.raisedAt.color,
            item.raisedAt.position,
          ),
          new InboxStationResponseDto(
            item.standsAt.name,
            item.standsAt.color,
            item.standsAt.position,
          ),
          item.createdAt,
          item.askedAt,
          item.resolved,
          item.working,
          item.runId,
          item.unread,
          item.briefing,
          item.failure ? new InboxFailureResponseDto(item.failure) : null,
          item.notes.map(
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
                note.approval
                  ? new InboxApprovalResponseDto(note.approval)
                  : null,
                note.failure ? new InboxFailureResponseDto(note.failure) : null,
              ),
          ),
        ),
    );
  }

  @Post(':itemId/answer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'answerInboxItem',
    summary: 'Answer what a conversation is waiting on, and let it carry on',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'itemId', type: String, example: 'task_1:0' })
  @ApiNoContentResponse({ description: 'The answer was recorded' })
  @ApiNotFoundResponse({ description: 'No such conversation for this caller' })
  @ApiConflictResponse({
    description:
      'Only a conversation waiting on a tool call can be approved or rejected',
  })
  async answer(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AnswerInboxItemRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AnswerInboxItemCommand(
        itemId,
        user.id,
        body.body ?? '',
        AttachmentHttpMapper.ids(body.attachments),
        body.approve === undefined
          ? null
          : body.approve
            ? 'granted'
            : 'refused',
      ),
    );
  }

  @Post(':itemId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'readInboxItem',
    summary: 'Mark what was put to a person as seen',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'itemId', type: String, example: 'task_1:0' })
  @ApiNoContentResponse({ description: 'It is no longer unread' })
  @ApiNotFoundResponse({ description: 'No such conversation for this caller' })
  async read(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new ReadInboxItemCommand(itemId, user.id));
  }

  @Get('tasks/:taskId/journal')
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
      RunJournalDto[] | null
    >(new ReadTaskJournalQuery(taskId, user.id));

    if (!worked) {
      throw new NotFoundException();
    }

    return worked.map(RunJournalHttpMapper.toResponse);
  }
}

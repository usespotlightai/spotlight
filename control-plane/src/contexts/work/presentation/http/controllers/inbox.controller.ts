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
  ApiExtraModels,
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
import { MarkInboxItemReadCommand } from '@work/application/commands/mark-inbox-item-read.command';
import { MarkInboxRequestReadCommand } from '@work/application/commands/mark-inbox-request-read.command';
import { ResolveNoticeCommand } from '@work/application/commands/resolve-notice.command';
import type {
  InboxEntryDto,
  InboxItemDto,
} from '@work/application/dto/inbox.dto';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import { ListInboxQuery } from '@work/application/queries/list-inbox.query';
import { ReadTaskJournalQuery } from '@work/application/queries/read-task-journal.query';
import {
  AnswerInboxItemRequestDto,
  INBOX_ENTRY_SCHEMA,
  InboxApprovalResponseDto,
  InboxAuthorResponseDto,
  InboxConnectionResponseDto,
  InboxFailureResponseDto,
  InboxItemResponseDto,
  InboxNoticeResponseDto,
  InboxRequestResponseDto,
  InboxStationResponseDto,
  NoteResponseDto,
} from '@work/presentation/http/dto/inbox.response.dto';
import { RunJournalResponseDto } from '@work/presentation/http/dto/run-journal.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';
import { editsInput } from '@work/presentation/http/mappers/edits-input';
import { idsInput } from '@work/presentation/http/mappers/ids-input';
import { RunJournalHttpMapper } from '@work/presentation/http/mappers/run-journal.http.mapper';

const taskItemResponse = (item: InboxItemDto): InboxItemResponseDto =>
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
      item.originStation.name,
      item.originStation.color,
      item.originStation.position,
    ),
    new InboxStationResponseDto(
      item.currentStation.name,
      item.currentStation.color,
      item.currentStation.position,
    ),
    item.createdAt,
    item.askedAt,
    item.resolved,
    item.progress,
    item.runId,
    item.unread,
    item.briefing,
    item.failure ? new InboxFailureResponseDto(item.failure) : null,
    item.inboxRequest ? new InboxRequestResponseDto(item.inboxRequest) : null,
    item.notes.map(
      (note) =>
        new NoteResponseDto(
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
  );

@ApiTags('inbox')
@ApiExtraModels(InboxItemResponseDto, InboxNoticeResponseDto)
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
    summary:
      'What waits on a person, newest first: the tasks put to them, and notices about their team’s work',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ schema: INBOX_ENTRY_SCHEMA })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<(InboxItemResponseDto | InboxNoticeResponseDto)[]> {
    const waiting = await this.queryBus.execute<
      ListInboxQuery,
      InboxEntryDto[] | null
    >(new ListInboxQuery(slug, user.id));

    if (!waiting) {
      throw new NotFoundException();
    }

    return waiting.map((entry) =>
      entry.kind === 'notice'
        ? new InboxNoticeResponseDto(entry)
        : taskItemResponse(entry),
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
      'Only a conversation waiting on a tool call can be approved or rejected, and only an approved tool call can be changed, naming exactly the inputs it was called with',
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
        idsInput(body.attachments),
        body.approve === undefined
          ? null
          : body.approve
            ? 'approved'
            : 'dismissed',
        editsInput(body.inputs),
      ),
    );
  }

  @Post(':itemId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'markInboxItemRead',
    summary: 'Mark what was put to a person as seen',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'itemId', type: String, example: 'task_1:0' })
  @ApiNoContentResponse({ description: 'It is no longer unread' })
  @ApiNotFoundResponse({ description: 'No such conversation for this caller' })
  async markInboxItemRead(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new MarkInboxItemReadCommand(itemId, user.id),
    );
  }

  @Post('requests/:requestId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'markInboxRequestRead',
    summary: 'Mark an inbox request as seen',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'requestId', type: String, example: 'request_1' })
  @ApiNoContentResponse({ description: 'It is no longer unread' })
  @ApiNotFoundResponse({ description: 'No such inbox request for this caller' })
  async markInboxRequestRead(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new MarkInboxRequestReadCommand(requestId, user.id),
    );
  }

  @Post('notices/:noticeId/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'resolveInboxNotice',
    summary: 'Resolve a notice, once its person has dealt with it',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'noticeId', type: String })
  @ApiNoContentResponse({ description: 'It is resolved' })
  @ApiNotFoundResponse({ description: 'No such notice for this caller' })
  async resolveNotice(
    @Param('slug') slug: string,
    @Param('noticeId') noticeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new ResolveNoticeCommand(noticeId, slug, user.id),
    );
  }

  @Get('tasks/:taskId/journal')
  @ApiOperation({
    operationId: 'readTaskJournal',
    summary: 'What each run did to arrive at its result',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'taskId' })
  @ApiOkResponse({ type: RunJournalResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async journal(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunJournalResponseDto[]> {
    const entries = await this.queryBus.execute<
      ReadTaskJournalQuery,
      RunJournalDto[] | null
    >(new ReadTaskJournalQuery(taskId, user.id));

    if (!entries) {
      throw new NotFoundException();
    }

    return entries.map(RunJournalHttpMapper.toResponse);
  }
}

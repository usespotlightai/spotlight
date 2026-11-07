import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseEnumPipe,
  Post,
  Query,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/dto/authenticated-user.dto';
import { AnswerConversationCommand } from '@work/application/commands/answer-conversation.command';
import { MarkConversationReadCommand } from '@work/application/commands/mark-conversation-read.command';
import { MarkInboxRequestReadCommand } from '@work/application/commands/mark-inbox-request-read.command';
import { ReopenConversationCommand } from '@work/application/commands/reopen-conversation.command';
import { ReopenInboxRequestCommand } from '@work/application/commands/reopen-inbox-request.command';
import { ReopenNoticeCommand } from '@work/application/commands/reopen-notice.command';
import { ResolveConversationCommand } from '@work/application/commands/resolve-conversation.command';
import { ResolveInboxRequestCommand } from '@work/application/commands/resolve-inbox-request.command';
import { ResolveNoticeCommand } from '@work/application/commands/resolve-notice.command';
import type {
  InboxEntryDto,
  InboxItemDto,
  InboxItemViewDto,
  InboxNoticeDto,
  NoteDto,
} from '@work/application/dto/inbox.dto';
import { mapPage, type Page } from '@work/application/dto/page.dto';
import type {
  JournalledRunDto,
  RunJournalDto,
} from '@work/application/dto/run-journal.dto';
import {
  INBOX_LIST_STATES,
  type InboxListState,
  ListInboxQuery,
  ReadInboxItemQuery,
  ReadInboxNoticeQuery,
} from '@work/application/queries/list-inbox.query';
import {
  ListTaskJournalRunsQuery,
  ReadTaskJournalQuery,
} from '@work/application/queries/read-task-journal.query';
import {
  AnswerInboxItemRequestDto,
  INBOX_PAGE_SCHEMA,
  InboxApprovalResponseDto,
  InboxAuthorResponseDto,
  InboxConnectionResponseDto,
  type InboxEntryResponseDto,
  InboxFailureResponseDto,
  InboxItemResponseDto,
  InboxItemViewResponseDto,
  InboxNoticeResponseDto,
  InboxRequestResponseDto,
  InboxRunResponseDto,
  InboxStationResponseDto,
  NoteResponseDto,
} from '@work/presentation/http/dto/inbox.response.dto';
import {
  JournalledRunResponseDto,
  RunJournalResponseDto,
} from '@work/presentation/http/dto/run-journal.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';
import { draftGenerationInput } from '@work/presentation/http/mappers/draft-generation-input';
import { editsInput } from '@work/presentation/http/mappers/edits-input';
import { idsInput } from '@work/presentation/http/mappers/ids-input';
import { RunJournalHttpMapper } from '@work/presentation/http/mappers/run-journal.http.mapper';
import { ApiPageQuery, pageRequestOf } from '@work/presentation/http/paging';

const noteResponse = (note: NoteDto): NoteResponseDto =>
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
    note.coAuthors.map(
      (each) => new InboxAuthorResponseDto(each.id, each.name, each.image),
    ),
    note.approval ? new InboxApprovalResponseDto(note.approval) : null,
    note.failure ? new InboxFailureResponseDto(note.failure) : null,
    note.connection ? new InboxConnectionResponseDto(note.connection) : null,
  );

const taskItemFields = (
  item: InboxItemDto,
): Omit<InboxItemResponseDto, 'kind'> => ({
  id: item.id,
  taskId: item.taskId,
  teamId: item.teamId,
  title: item.title,
  description: item.description,
  attachments: item.attachments.map(AttachmentHttpMapper.toResponse),
  station: item.station,
  stationColor: item.stationColor,
  stationPosition: item.stationPosition,
  stationCount: item.stationCount,
  originStation: new InboxStationResponseDto(
    item.originStation.name,
    item.originStation.color,
    item.originStation.position,
  ),
  currentStation: new InboxStationResponseDto(
    item.currentStation.name,
    item.currentStation.color,
    item.currentStation.position,
  ),
  createdAt: item.createdAt,
  askedAt: item.askedAt,
  resolved: item.resolved,
  section: item.section,
  reopenable: item.reopenable,
  progress: item.progress,
  runId: item.runId,
  unread: item.unread,
  briefing: item.briefing,
  failure: item.failure ? new InboxFailureResponseDto(item.failure) : null,
  inboxRequest: item.inboxRequest
    ? new InboxRequestResponseDto(item.inboxRequest)
    : null,
  lastNote: item.lastNote && noteResponse(item.lastNote),
});

const entryResponse = (entry: InboxEntryDto): InboxEntryResponseDto => {
  if (entry.kind === 'notice') {
    return new InboxNoticeResponseDto(entry);
  }

  return entry.kind === 'run'
    ? new InboxRunResponseDto(entry)
    : new InboxItemResponseDto(taskItemFields(entry));
};

@ApiTags('inbox')
@ApiExtraModels(
  InboxItemResponseDto,
  InboxNoticeResponseDto,
  InboxRunResponseDto,
)
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
      'What waits on a person, newest first: the tasks put to them, the runs working on their tasks, and notices about their team’s work. Open entries come in one page; resolved entries come a page at a time',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: INBOX_LIST_STATES,
    description: '`open` (the default) or `resolved`',
  })
  @ApiPageQuery()
  @ApiOkResponse({ schema: INBOX_PAGE_SCHEMA })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @Query('state', new ParseEnumPipe(INBOX_LIST_STATES, { optional: true }))
    state: InboxListState | undefined,
    @Query('before') before: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Page<InboxEntryResponseDto>> {
    const waiting = await this.queryBus.execute<
      ListInboxQuery,
      Page<InboxEntryDto> | null
    >(
      new ListInboxQuery(
        slug,
        user.id,
        state ?? 'open',
        pageRequestOf(before, limit),
      ),
    );

    if (!waiting) {
      throw new NotFoundException();
    }

    return mapPage(waiting, entryResponse);
  }

  @Get(':itemId')
  @ApiOperation({
    operationId: 'readInboxItem',
    summary:
      'One conversation or inbox request with all its notes, open or resolved',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiParam({ name: 'itemId' })
  @ApiOkResponse({ type: InboxItemViewResponseDto })
  @ApiNotFoundResponse({ description: 'No such inbox item for this caller' })
  async read(
    @Param('slug') slug: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InboxItemViewResponseDto> {
    const found = await this.queryBus.execute<
      ReadInboxItemQuery,
      InboxItemViewDto | null
    >(new ReadInboxItemQuery(slug, itemId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new InboxItemViewResponseDto(
      taskItemFields(found),
      found.notes.map(noteResponse),
    );
  }

  @Get('notices/:noticeId')
  @ApiOperation({
    operationId: 'readInboxNotice',
    summary: 'One notice, open or resolved',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiParam({ name: 'noticeId' })
  @ApiOkResponse({ type: InboxNoticeResponseDto })
  @ApiNotFoundResponse({ description: 'No such notice for this caller' })
  async notice(
    @Param('slug') slug: string,
    @Param('noticeId') noticeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InboxNoticeResponseDto> {
    const found = await this.queryBus.execute<
      ReadInboxNoticeQuery,
      InboxNoticeDto | null
    >(new ReadInboxNoticeQuery(slug, noticeId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new InboxNoticeResponseDto(found);
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
      new AnswerConversationCommand(
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
        idsInput(body.coAuthors),
        draftGenerationInput(body.draftGeneration),
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
      new MarkConversationReadCommand(itemId, user.id),
    );
  }

  @Post(':itemId/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'resolveInboxItem',
    summary:
      'Close a conversation without an answer, stopping any run of its task',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'itemId', type: String, example: 'task_1:0' })
  @ApiNoContentResponse({ description: 'It is resolved' })
  @ApiNotFoundResponse({ description: 'No such conversation for this caller' })
  @ApiConflictResponse({ description: 'The conversation is already closed' })
  async resolveInboxItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new ResolveConversationCommand(itemId, user.id),
    );
  }

  @Post('requests/:requestId/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'resolveInboxRequest',
    summary: 'Resolve an inbox request without acting on it',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'requestId', type: String, example: 'request_1' })
  @ApiNoContentResponse({ description: 'It is resolved' })
  @ApiNotFoundResponse({ description: 'No such inbox request for this caller' })
  async resolveInboxRequest(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new ResolveInboxRequestCommand(requestId, user.id),
    );
  }

  @Post(':itemId/reopen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'reopenInboxItem',
    summary: 'Reopen a conversation a person resolved without an answer',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'itemId', type: String, example: 'task_1:0' })
  @ApiNoContentResponse({ description: 'It is open again' })
  @ApiNotFoundResponse({ description: 'No such conversation for this caller' })
  @ApiConflictResponse({
    description:
      'The conversation is not the last one, or a person did not resolve it',
  })
  async reopenInboxItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new ReopenConversationCommand(itemId, user.id),
    );
  }

  @Post('requests/:requestId/reopen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'reopenInboxRequest',
    summary: 'Reopen a resolved inbox request',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'requestId', type: String, example: 'request_1' })
  @ApiNoContentResponse({ description: 'It is open again' })
  @ApiNotFoundResponse({ description: 'No such inbox request for this caller' })
  async reopenInboxRequest(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new ReopenInboxRequestCommand(requestId, user.id),
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

  @Post('notices/:noticeId/reopen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'reopenInboxNotice',
    summary: 'Reopen a resolved notice',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'noticeId', type: String })
  @ApiNoContentResponse({ description: 'It is open again' })
  @ApiNotFoundResponse({ description: 'No such notice for this caller' })
  async reopenNotice(
    @Param('slug') slug: string,
    @Param('noticeId') noticeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new ReopenNoticeCommand(noticeId, slug, user.id),
    );
  }

  @Get('tasks/:taskId/journal')
  @ApiOperation({
    operationId: 'listTaskJournalRuns',
    summary: 'The runs of a task that have a journal, oldest first',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'taskId' })
  @ApiOkResponse({ type: JournalledRunResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async journalRuns(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JournalledRunResponseDto[]> {
    const runs = await this.queryBus.execute<
      ListTaskJournalRunsQuery,
      JournalledRunDto[] | null
    >(new ListTaskJournalRunsQuery(taskId, user.id));

    if (!runs) {
      throw new NotFoundException();
    }

    return runs.map(RunJournalHttpMapper.runToResponse);
  }

  @Get('tasks/:taskId/journal/:runId')
  @ApiOperation({
    operationId: 'readTaskJournal',
    summary: 'What one run of a task did to arrive at its result, per attempt',
  })
  @ApiParam({ name: 'slug', type: String, example: 'acme' })
  @ApiParam({ name: 'taskId' })
  @ApiParam({ name: 'runId' })
  @ApiOkResponse({ type: RunJournalResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async journal(
    @Param('taskId') taskId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunJournalResponseDto[]> {
    const entries = await this.queryBus.execute<
      ReadTaskJournalQuery,
      RunJournalDto[] | null
    >(new ReadTaskJournalQuery(taskId, runId, user.id));

    if (!entries) {
      throw new NotFoundException();
    }

    return entries.map(RunJournalHttpMapper.toResponse);
  }
}

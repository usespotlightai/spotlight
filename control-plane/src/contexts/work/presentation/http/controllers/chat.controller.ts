import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
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
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import {
  AcceptProposalCommand,
  DismissProposalCommand,
  SayInChatCommand,
  StartChatCommand,
  StopChatCommand,
} from '@work/application/commands/chat.commands';
import type { ChatDto, ChatSummaryDto } from '@work/application/dto/chat.dto';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import {
  ListChatsQuery,
  ReadChatJournalQuery,
  ReadChatQuery,
} from '@work/application/queries/chat.queries';
import {
  SayInChatRequestDto,
  StartChatRequestDto,
} from '@work/presentation/http/dto/chat.request.dto';
import {
  ChatResponseDto,
  ChatSummaryResponseDto,
} from '@work/presentation/http/dto/chat.response.dto';
import { RunJournalResponseDto } from '@work/presentation/http/dto/run-journal.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';
import { ChatHttpMapper } from '@work/presentation/http/mappers/chat.http.mapper';
import { RunJournalHttpMapper } from '@work/presentation/http/mappers/run-journal.http.mapper';

@ApiTags('chats')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({
  name: 'teamId',
  type: String,
  example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
})
@Controller('teams/:teamId/chats')
export class ChatController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listChats',
    summary:
      'The chats the caller has started with the team’s agent, latest first',
  })
  @ApiOkResponse({ type: ChatSummaryResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChatSummaryResponseDto[]> {
    const chats = await this.queryBus.execute<
      ListChatsQuery,
      ChatSummaryDto[] | null
    >(new ListChatsQuery(teamId, user.id));

    if (!chats) {
      throw new NotFoundException();
    }

    return chats.map(ChatHttpMapper.summaryToResponse);
  }

  @Post()
  @ApiOperation({
    operationId: 'startChat',
    summary: 'Start planning with the team’s agent',
  })
  @ApiCreatedResponse({ type: ChatResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'An unknown harness, model, effort or repository',
  })
  async start(
    @Param('teamId') teamId: string,
    @Body() body: StartChatRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChatResponseDto> {
    const chatId = await this.commandBus.execute<
      StartChatCommand,
      string | null
    >(
      new StartChatCommand(
        teamId,
        user.id,
        body.harness,
        body.model ?? null,
        body.effort ?? null,
        Array.isArray(body.repositories) ? body.repositories : [],
        body.body ?? '',
        AttachmentHttpMapper.ids(body.attachments),
      ),
    );

    if (!chatId) {
      throw new NotFoundException();
    }

    return this.read(teamId, chatId, user);
  }

  @Get(':chatId')
  @ApiOperation({
    operationId: 'readChat',
    summary: 'A chat, with everything said and proposed in it',
  })
  @ApiParam({ name: 'chatId', type: String })
  @ApiOkResponse({ type: ChatResponseDto })
  @ApiNotFoundResponse({ description: 'No such chat for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @Param('chatId') chatId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChatResponseDto> {
    const chat = await this.queryBus.execute<ReadChatQuery, ChatDto | null>(
      new ReadChatQuery(teamId, chatId, user.id),
    );

    if (!chat) {
      throw new NotFoundException();
    }

    return ChatHttpMapper.toResponse(chat);
  }

  @Get(':chatId/journal')
  @ApiOperation({
    operationId: 'readChatJournal',
    summary: 'What the agent did and said in each run of a chat',
  })
  @ApiParam({ name: 'chatId', type: String })
  @ApiOkResponse({ type: RunJournalResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such chat for this caller' })
  async journal(
    @Param('teamId') teamId: string,
    @Param('chatId') chatId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunJournalResponseDto[]> {
    const journals = await this.queryBus.execute<
      ReadChatJournalQuery,
      RunJournalDto[] | null
    >(new ReadChatJournalQuery(teamId, chatId, user.id));

    if (!journals) {
      throw new NotFoundException();
    }

    return journals.map(RunJournalHttpMapper.toResponse);
  }

  @Post(':chatId/messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'sayInChat',
    summary: 'Say something to the agent in a chat',
  })
  @ApiParam({ name: 'chatId', type: String })
  @ApiNoContentResponse({ description: 'The agent hears it' })
  @ApiNotFoundResponse({ description: 'No such chat for this caller' })
  async say(
    @Param('teamId') teamId: string,
    @Param('chatId') chatId: string,
    @Body() body: SayInChatRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new SayInChatCommand(
        teamId,
        chatId,
        user.id,
        body.body ?? '',
        AttachmentHttpMapper.ids(body.attachments),
      ),
    );
  }

  @Post(':chatId/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'stopChat',
    summary: 'Stop the agent answering in a chat',
  })
  @ApiParam({ name: 'chatId', type: String })
  @ApiNoContentResponse({ description: 'The agent was asked to stop' })
  @ApiNotFoundResponse({ description: 'No such chat for this caller' })
  @ApiConflictResponse({ description: 'The agent is not answering' })
  async stop(
    @Param('teamId') teamId: string,
    @Param('chatId') chatId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new StopChatCommand(teamId, chatId, user.id));
  }

  @Post(':chatId/proposals/:position/acceptance')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'acceptProposal',
    summary: 'Accept a task the agent proposed, so it is created',
  })
  @ApiParam({ name: 'chatId', type: String })
  @ApiParam({ name: 'position', type: Number })
  @ApiNoContentResponse({ description: 'The task is being created' })
  @ApiNotFoundResponse({ description: 'No such chat for this caller' })
  @ApiConflictResponse({ description: 'The proposal is already settled' })
  async accept(
    @Param('teamId') teamId: string,
    @Param('chatId') chatId: string,
    @Param('position', ParseIntPipe) position: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new AcceptProposalCommand(teamId, chatId, position, user.id),
    );
  }

  @Post(':chatId/proposals/:position/dismissal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'dismissProposal',
    summary: 'Turn down a task the agent proposed',
  })
  @ApiParam({ name: 'chatId', type: String })
  @ApiParam({ name: 'position', type: Number })
  @ApiNoContentResponse({ description: 'The proposal was dismissed' })
  @ApiNotFoundResponse({ description: 'No such chat for this caller' })
  @ApiConflictResponse({ description: 'The proposal is already settled' })
  async dismiss(
    @Param('teamId') teamId: string,
    @Param('chatId') chatId: string,
    @Param('position', ParseIntPipe) position: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new DismissProposalCommand(teamId, chatId, position, user.id),
    );
  }
}

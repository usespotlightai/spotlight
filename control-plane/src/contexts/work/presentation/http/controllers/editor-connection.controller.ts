import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { ConnectEditorCommand } from '@work/application/commands/connect-editor.command';
import type {
  EditorConnectionDto,
  EditorConnectionStateDto,
  EditorTarget,
} from '@work/application/dto/editor-connection.dto';
import { ReadEditorConnectionQuery } from '@work/application/queries/editor-connection.query';
import { EditorConnectionStateResponseDto } from '@work/presentation/http/dto/editor-connection-state.response.dto';
import { ConnectEditorRequestDto } from '@work/presentation/http/dto/editor-connection.request.dto';
import { EditorConnectionResponseDto } from '@work/presentation/http/dto/editor-connection.response.dto';

const textOf = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const targetOf = (named: {
  readonly task?: unknown;
  readonly chat?: unknown;
}): EditorTarget => {
  const task = textOf(named.task);
  const chat = textOf(named.chat);

  if ((task === '') === (chat === '')) {
    throw new BadRequestException('Name one task or one chat.');
  }

  return task ? { kind: 'task', id: task } : { kind: 'chat', id: chat };
};

@ApiTags('editor-connections')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('editor-connections')
export class EditorConnectionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readEditorConnection',
    summary: 'Whether an editor holds the sandbox of a task or a chat now',
  })
  @ApiQuery({
    name: 'task',
    required: false,
    description: 'The task. Name a task or a chat.',
  })
  @ApiQuery({
    name: 'chat',
    required: false,
    description: 'The chat. Name a task or a chat.',
  })
  @ApiQuery({
    name: 'workspace',
    required: false,
    description: 'The workspace the task or chat must be in',
  })
  @ApiOkResponse({ type: EditorConnectionStateResponseDto })
  @ApiBadRequestResponse({ description: 'No task and no chat, or both' })
  @ApiNotFoundResponse({
    description: 'No such task or chat that the caller may open in an editor',
  })
  @ApiForbiddenResponse({
    description:
      'The caller is not a member of the team, nor a workspace admin',
  })
  async read(
    @Query('task') task: string | undefined,
    @Query('chat') chat: string | undefined,
    @Query('workspace') workspace: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EditorConnectionStateResponseDto> {
    const target = targetOf({ task, chat });
    const state = await this.queryBus.execute<
      ReadEditorConnectionQuery,
      EditorConnectionStateDto | null
    >(
      new ReadEditorConnectionQuery(user.id, target, textOf(workspace) || null),
    );

    if (!state) {
      throw new NotFoundException(
        `No ${target.kind} ${target.id} that you may open in an editor.`,
      );
    }

    return new EditorConnectionStateResponseDto(state.connected);
  }

  @Post()
  @ApiOperation({
    operationId: 'connectEditor',
    summary:
      'Hold the sandbox of a task or a chat for an editor, and get the lease that opens its socket',
  })
  @ApiCreatedResponse({ type: EditorConnectionResponseDto })
  @ApiBadRequestResponse({ description: 'No task and no chat, or both' })
  @ApiNotFoundResponse({
    description: 'No such task or chat that the caller may open in an editor',
  })
  @ApiForbiddenResponse({
    description:
      'The caller is not a member of the team, nor a workspace admin',
  })
  async connect(
    @Body() body: ConnectEditorRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EditorConnectionResponseDto> {
    const target = targetOf(body ?? {});
    const connection = await this.commandBus.execute<
      ConnectEditorCommand,
      EditorConnectionDto | null
    >(
      new ConnectEditorCommand(
        user.id,
        target,
        textOf(body?.workspace) || null,
      ),
    );

    if (!connection) {
      throw new NotFoundException(
        `No ${target.kind} ${target.id} that you may open in an editor.`,
      );
    }

    return new EditorConnectionResponseDto(
      connection.sandboxId,
      connection.holder,
    );
  }
}

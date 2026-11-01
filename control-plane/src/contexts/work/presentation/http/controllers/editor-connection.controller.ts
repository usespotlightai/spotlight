import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { EDITOR_CONNECTIONS } from '@platform/http/routes';
import type { EditorLease } from '@runners/application/ports/editor-leases.port';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import {
  ConnectEditorCommand,
  type EditorTarget,
} from '@work/application/commands/connect-editor.command';
import { ConnectEditorRequestDto } from '@work/presentation/http/dto/editor-connection.request.dto';
import { EditorConnectionResponseDto } from '@work/presentation/http/dto/editor-connection.response.dto';

const textOf = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const targetOf = (body: ConnectEditorRequestDto): EditorTarget => {
  const task = textOf(body?.task);
  const chat = textOf(body?.chat);

  if ((task === '') === (chat === '')) {
    throw new BadRequestException('Name one task or one chat.');
  }

  return task ? { kind: 'task', id: task } : { kind: 'chat', id: chat };
};

@ApiTags('editor-connections')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller(EDITOR_CONNECTIONS)
export class EditorConnectionController {
  constructor(private readonly commandBus: CommandBus) {}

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
  async connect(
    @Body() body: ConnectEditorRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EditorConnectionResponseDto> {
    const target = targetOf(body);
    const connection = await this.commandBus.execute<
      ConnectEditorCommand,
      EditorLease | null
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

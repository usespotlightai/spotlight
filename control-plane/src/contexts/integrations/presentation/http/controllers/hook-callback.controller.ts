import type { NotedByCallback } from '@integrations/application/commands/handlers/note-by-callback.handler';
import { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { CallbackTaskView } from '@integrations/application/dto/callback-task-view.dto';
import { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import { CallbackNoteRequestDto } from '@integrations/presentation/http/dto/callback-note.request.dto';
import { CallbackTaskResponseDto } from '@integrations/presentation/http/dto/callback-task.response.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { bearerIn } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { HOOK_CALLBACKS } from '@platform/http/routes';

const UNAUTHORIZED =
  'The callback token is missing, expired or unknown. Each hook request carries a fresh token in spotlight-callback-token.';

@ApiTags('hooks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: UNAUTHORIZED })
@AllowAnonymous()
@Controller(HOOK_CALLBACKS)
export class HookCallbackController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('task')
  @ApiOperation({
    operationId: 'readHookTask',
    summary: 'Read the task a hook request was about',
  })
  @ApiOkResponse({ type: CallbackTaskResponseDto })
  async task(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<CallbackTaskResponseDto> {
    const task = await this.queryBus.execute<
      CallbackTaskQuery,
      CallbackTaskView | null
    >(new CallbackTaskQuery(bearerIn(authorization) ?? ''));

    if (!task) {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    return new CallbackTaskResponseDto(task);
  }

  @Post('notes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'noteOnHookTask',
    summary: 'Add a note to the task that a hook request was about',
  })
  @ApiBody({ type: CallbackNoteRequestDto })
  @ApiNoContentResponse({ description: 'The note is on the task' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'The same on every retry of one note, so a retried note is added once',
  })
  async note(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CallbackNoteRequestDto,
  ): Promise<void> {
    const noted = await this.commandBus.execute<
      NoteByCallbackCommand,
      NotedByCallback
    >(
      new NoteByCallbackCommand(
        bearerIn(authorization) ?? '',
        typeof body?.body === 'string' ? body.body : '',
        idempotencyKey?.trim().slice(0, 255) || null,
      ),
    );

    if (noted === 'empty') {
      throw new BadRequestException(
        'Note must not be empty. Maximum length: 20000 characters',
      );
    }

    if (noted === 'rejected') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }
  }
}

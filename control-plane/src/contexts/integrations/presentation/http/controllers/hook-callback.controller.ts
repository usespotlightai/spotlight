import type { NotedByCallback } from '@integrations/application/commands/handlers/note-by-callback.handler';
import { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { CallbackTaskDto } from '@integrations/application/dto/callback-task.dto';
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

const REFUSED =
  'Missing, expired or unknown callback token; each hook request carries a fresh one in spotlight-callback-token';

@ApiTags('hooks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: REFUSED })
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
      CallbackTaskDto | null
    >(new CallbackTaskQuery(bearerIn(authorization) ?? ''));

    if (!task) {
      throw new UnauthorizedException(REFUSED);
    }

    return new CallbackTaskResponseDto(task);
  }

  @Post('notes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'noteOnHookTask',
    summary: 'Say something on the task a hook request was about',
  })
  @ApiBody({ type: CallbackNoteRequestDto })
  @ApiNoContentResponse({ description: 'The note is on the task' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'The same on every retry of one note, so a retried note is said once',
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
        'A note says something, in at most 20000 characters',
      );
    }

    if (noted === 'refused') {
      throw new UnauthorizedException(REFUSED);
    }
  }
}

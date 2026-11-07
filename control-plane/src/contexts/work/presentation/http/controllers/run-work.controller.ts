import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AcceptsLargeBody } from '@platform/http/decorators/accepts-large-body.decorator';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';
import { AckMessagesCommand } from '@work/application/commands/ack-messages.command';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { GrantRunAttachmentUploadCommand } from '@work/application/commands/grant-run-attachment-upload.command';
import { ReplyToReviewCommentCommand } from '@work/application/commands/reply-to-review-comment.command';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
import type { AttachmentUploadDto } from '@work/application/dto/attachment.dto';
import type { PendingMessageDto } from '@work/application/dto/pending-message.dto';
import type { PermissionAnswerDto } from '@work/application/dto/permission-answer.dto';
import type { RunnerHistoryAnswer } from '@work/application/dto/runner-history.dto';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import type { ToolAnswerDto } from '@work/application/dto/tool-answer.dto';
import type { AttachmentContent } from '@work/application/ports/attachment-store.port';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { GrantAttachmentUploadRequestDto } from '@work/presentation/http/dto/attachment.request.dto';
import { AttachmentUploadResponseDto } from '@work/presentation/http/dto/attachment.response.dto';
import {
  PendingMessageResponseDto,
  RunAttachmentResponseDto,
} from '@work/presentation/http/dto/run-work.response.dto';
import {
  AckMessagesRequestDto,
  AskPermissionRequestDto,
  ReplyToReviewCommentRequestDto,
} from '@work/presentation/http/dto/runner.request.dto';
import {
  PermissionAnswerResponseDto,
  ToolActingAsResponseDto,
  ToolAnswerResponseDto,
} from '@work/presentation/http/dto/runner.response.dto';
import { RunnerHistoryResponseDto } from '@work/presentation/http/dto/runner-history.response.dto';
import { TaskTraceResponseDto } from '@work/presentation/http/dto/task-trace.response.dto';
import { RunnerHistoryHttpMapper } from '@work/presentation/http/mappers/runner-history.http.mapper';
import { TaskTraceHttpMapper } from '@work/presentation/http/mappers/task-trace.http.mapper';

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@RunnerOnly()
@Controller()
export class RunWorkController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('runs/:runId/messages')
  @ApiOperation({
    operationId: 'pendingMessages',
    summary: 'The messages that a person sent to the agent of this run',
  })
  @ApiOkResponse({ type: PendingMessageResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such run leased by this runner' })
  async messages(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<PendingMessageResponseDto[]> {
    const waiting = await this.queryBus.execute<
      PendingMessagesQuery,
      PendingMessageDto[]
    >(new PendingMessagesQuery(runId, runnerId));

    return waiting.map(
      (each) =>
        new PendingMessageResponseDto(
          each.position,
          each.body,
          each.attachments.map(
            (file) => new RunAttachmentResponseDto(file.id, file.path),
          ),
        ),
    );
  }

  @Get('runs/:runId/attachments/:attachmentId')
  @ApiOperation({
    operationId: 'readRunAttachment',
    summary: 'A file attached to the run’s task, to lay out in its workspace',
  })
  @ApiOkResponse({ description: 'The file, byte for byte' })
  @ApiNotFoundResponse({
    description: 'No such file, or not this runner’s run to read it for',
  })
  async attachment(
    @Param('runId') runId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<StreamableFile> {
    const content = await this.queryBus.execute<
      ReadRunAttachmentQuery,
      AttachmentContent | null
    >(new ReadRunAttachmentQuery(runId, runnerId, attachmentId));

    if (!content) {
      throw new NotFoundException();
    }

    return new StreamableFile(content.bytes, {
      type: content.contentType,
      length: content.bytes.byteLength,
    });
  }

  @Post('runs/:runId/attachments')
  @ApiOperation({
    operationId: 'grantRunAttachmentUpload',
    summary: 'Somewhere to upload one file the agent attaches to its handover',
    description:
      'The bytes go straight to where files are stored, not through here. ' +
      'The file joins the task when its id is sent with the run’s handover.',
  })
  @ApiCreatedResponse({ type: AttachmentUploadResponseDto })
  @ApiNotFoundResponse({
    description: 'No such run, or not this runner’s run to attach to',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Too large to attach, or nowhere to store it',
  })
  async grantAttachment(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: GrantAttachmentUploadRequestDto,
  ): Promise<AttachmentUploadResponseDto> {
    const granted = await this.commandBus.execute<
      GrantRunAttachmentUploadCommand,
      AttachmentUploadDto | null
    >(
      new GrantRunAttachmentUploadCommand(
        runId,
        runnerId,
        body.name ?? '',
        body.contentType ?? '',
        body.size,
      ),
    );

    if (!granted) {
      throw new NotFoundException();
    }

    return new AttachmentUploadResponseDto(
      granted.id,
      granted.url,
      granted.headers,
    );
  }

  @Get('runs/:runId/trace/:taskId')
  @ApiOperation({
    operationId: 'readRunTrace',
    summary: "Read a task's trace, for an agent studying one of its own team",
  })
  @ApiOkResponse({ type: TaskTraceResponseDto })
  @ApiNotFoundResponse({
    description: 'No such run or task, or not this run’s team to read',
  })
  async trace(
    @Param('runId') runId: string,
    @Param('taskId') taskId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<TaskTraceResponseDto> {
    const trace = await this.queryBus.execute<
      ReadRunnerTraceQuery,
      TaskTraceDto | null
    >(new ReadRunnerTraceQuery(runId, runnerId, taskId));

    if (!trace) {
      throw new NotFoundException();
    }

    return TaskTraceHttpMapper.toResponse(trace);
  }

  @Get('runs/:runId/history')
  @ApiOperation({
    operationId: 'readRunHistory',
    summary:
      "Read a station's recent runs, their configs, journals, changes and outcomes, for an agent studying its own team",
  })
  @ApiQuery({ name: 'station', type: String })
  @ApiQuery({ name: 'line', type: String, required: false })
  @ApiQuery({ name: 'fingerprint', type: String, required: false })
  @ApiQuery({ name: 'outcome', type: String, required: false })
  @ApiQuery({ name: 'since', type: String, required: false })
  @ApiQuery({ name: 'last', type: Number, required: false })
  @ApiOkResponse({ type: RunnerHistoryResponseDto })
  @ApiNotFoundResponse({
    description: 'No such run, or no such station in its team',
  })
  @ApiConflictResponse({
    description: 'Several of the team’s lines have a station by that key',
  })
  async history(
    @Param('runId') runId: string,
    @Query('station') station: string | undefined,
    @Query('line') line: string | undefined,
    @Query('fingerprint') fingerprint: string | undefined,
    @Query('outcome') outcome: string | undefined,
    @Query('since') since: string | undefined,
    @Query('last') last: string | undefined,
    @CurrentRunner() runnerId: string,
  ): Promise<RunnerHistoryResponseDto> {
    if (!station?.trim()) {
      throw new NotFoundException();
    }

    const answer = await this.queryBus.execute<
      ReadRunnerHistoryQuery,
      RunnerHistoryAnswer
    >(
      new ReadRunnerHistoryQuery(runId, runnerId, {
        station: station.trim(),
        line: line?.trim() || null,
        fingerprint: fingerprint?.trim() || null,
        outcome: outcome?.trim() || null,
        since: since?.trim() || null,
        last: last ? Number(last) : null,
      }),
    );

    switch (answer.kind) {
      case 'found':
        return RunnerHistoryHttpMapper.toResponse(answer.history);
      case 'ambiguous':
        throw new ConflictException(
          `Several lines have a station by that key; name one with --line: ${answer.lines.join(', ')}`,
        );
      default:
        throw new NotFoundException();
    }
  }

  @Post('runs/:runId/messages/ack')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'ackMessages',
    summary: 'Acknowledge the messages that the agent got',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'The run is not leased by this runner' })
  async ackMessages(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: AckMessagesRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AckMessagesCommand(runId, runnerId, body.upTo),
    );
  }

  @AcceptsLargeBody()
  @Post('runs/:runId/tools/:tool')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'useTool',
    summary: 'Do what a tool enabled for the run does',
    description:
      'The input and the answer are the tool\u2019s own. Only for a tool ' +
      'enabled for the run; any credential it needs is added by Spotlight, never ' +
      'sent by the run.',
  })
  @ApiParam({ name: 'tool', example: 'pull-request' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: { title: 'Fix the queue', body: 'What it does.' },
    },
  })
  @ApiOkResponse({ type: ToolAnswerResponseDto })
  @ApiForbiddenResponse({ description: 'This tool is not enabled for the run' })
  @ApiNotFoundResponse({
    description: 'No such run, station or tool for this runner',
  })
  @ApiConflictResponse({ description: 'The run works no task to use it on' })
  @ApiUnprocessableEntityResponse({
    description: 'What the agent handed the tool is not what it takes',
  })
  @ApiBadGatewayResponse({
    description: 'The integration the tool calls answered with an error',
  })
  async useTool(
    @Param('runId') runId: string,
    @Param('tool') tool: string,
    @CurrentRunner() runnerId: string,
    @Body() input: Record<string, unknown>,
  ): Promise<ToolAnswerResponseDto> {
    const answered = await this.commandBus.execute<
      UseToolCommand,
      ToolAnswerDto
    >(new UseToolCommand(runId, runnerId, tool, input ?? {}));

    return new ToolAnswerResponseDto(
      answered.output,
      answered.actingAs ? new ToolActingAsResponseDto(answered.actingAs) : null,
    );
  }

  @Post('runs/:runId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'askPermission',
    summary: 'Ask whether the harness may do what it asked to',
    description:
      'Only for a run whose station names a harness profile. An approval the ' +
      'task already has for this exact call is spent on it; otherwise a ' +
      'person is asked in their inbox, and the run waits for their answer once its turn ends.',
  })
  @ApiOkResponse({ type: PermissionAnswerResponseDto })
  @ApiConflictResponse({ description: 'The run is not leased by this runner' })
  async askPermission(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: AskPermissionRequestDto,
  ): Promise<PermissionAnswerResponseDto> {
    const answered = await this.commandBus.execute<
      AskPermissionCommand,
      PermissionAnswerDto
    >(
      new AskPermissionCommand(runId, runnerId, {
        sessionId: body.sessionId || null,
        kind: body.kind ?? '',
        title: body.title ?? '',
        input: body.input,
      }),
    );

    return new PermissionAnswerResponseDto(answered.decision);
  }

  @Post('runs/:runId/review-comment-replies')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'replyToReviewComment',
    summary: 'Reply to a review comment on the pull request, and resolve it',
    description:
      'Spotlight replies with its own credential. No GitHub credential ' +
      'is ever sent to a runner.',
  })
  @ApiNoContentResponse()
  async replyToReviewComment(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: ReplyToReviewCommentRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new ReplyToReviewCommentCommand(
        runId,
        runnerId,
        body.handle,
        body.body,
        body.resolve ?? false,
      ),
    );
  }
}

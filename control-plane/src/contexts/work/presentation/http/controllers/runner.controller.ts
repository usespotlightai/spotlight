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
  Res,
  StreamableFile,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiConflictResponse,
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
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';
import { AckMessagesCommand } from '@work/application/commands/ack-messages.command';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { ReplyToReviewCommentCommand } from '@work/application/commands/reply-to-review-comment.command';
import {
  AppendRunJournalCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  RecordRunImageCommand,
  RecordStartingPointCommand,
  RenewCheckLeaseCommand,
  RenewLeaseCommand,
} from '@work/application/commands/runner.commands';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
import type { HarnessDto } from '@work/application/dto/harness.dto';
import type { PendingMessageDto } from '@work/application/dto/pending-message.dto';
import type { PermissionAnswerDto } from '@work/application/dto/permission-answer.dto';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { RunnerHistoryAnswer } from '@work/application/dto/runner-history.dto';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import type { ToolAnswerDto } from '@work/application/dto/tool-answer.dto';
import type { AttachmentContent } from '@work/application/ports/attachment-store.port';
import type { CheckLeaseRenewal } from '@work/application/ports/check-work.port';
import { HarnessCatalogueQuery } from '@work/application/queries/list-harnesses.query';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { RunStopRequestedQuery } from '@work/application/queries/run-stop-requested.query';
import { HarnessProbeResponseDto } from '@work/presentation/http/dto/harness-probe.response.dto';
import {
  AckMessagesRequestDto,
  AppendRunEventsRequestDto,
  AskPermissionRequestDto,
  CompleteRunRequestDto,
  PendingMessageResponseDto,
  RecordRunImageRequestDto,
  RecordStartingPointRequestDto,
  ReplyToReviewCommentRequestDto,
  RunAttachmentResponseDto,
} from '@work/presentation/http/dto/runner.request.dto';
import {
  ClaimedWorkResponseDto,
  PermissionAnswerResponseDto,
  RenewCheckLeaseResponseDto,
  RenewLeaseResponseDto,
  ToolActingAsResponseDto,
  ToolAnswerResponseDto,
} from '@work/presentation/http/dto/runner.response.dto';
import { RunnerHistoryResponseDto } from '@work/presentation/http/dto/runner-history.response.dto';
import { TaskTraceResponseDto } from '@work/presentation/http/dto/task-trace.response.dto';
import { ClaimedWorkHttpMapper } from '@work/presentation/http/mappers/claimed-work.http.mapper';
import { RunnerHistoryHttpMapper } from '@work/presentation/http/mappers/runner-history.http.mapper';
import { TaskTraceHttpMapper } from '@work/presentation/http/mappers/task-trace.http.mapper';

const textAt = (raw: unknown, key: string): string => {
  const value =
    raw !== null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)[key]
      : undefined;

  return typeof value === 'string' ? value : '';
};

const startedCheckoutOf = (raw: unknown) => ({
  path: textAt(raw, 'path'),
  commit: textAt(raw, 'commit'),
});

interface Answerable {
  status(code: number): unknown;
}

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@RunnerOnly()
@Controller()
export class RunnerController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('runners/harnesses')
  @ApiOperation({
    operationId: 'listHarnessProbes',
    summary: 'What to look for on this runner, so it can say what it has',
  })
  @ApiOkResponse({ type: HarnessProbeResponseDto, isArray: true })
  async harnesses(): Promise<HarnessProbeResponseDto[]> {
    const harnesses = await this.queryBus.execute<
      HarnessCatalogueQuery,
      HarnessDto[]
    >(new HarnessCatalogueQuery());

    return harnesses.map(
      (harness) =>
        new HarnessProbeResponseDto(
          harness.id,
          harness.executable,
          harness.discovery,
          harness.versionProbe,
        ),
    );
  }

  @Post('runners/claim')
  @ApiOperation({
    operationId: 'claimRun',
    summary: 'Long-poll for work, answering empty when the queue is',
    description:
      'Work is either a run to carry out or a change stack check to run ' +
      'against a fresh checkout. A run always comes first.',
  })
  @ApiOkResponse({ type: ClaimedWorkResponseDto })
  @ApiNoContentResponse({ description: 'Nothing queued for this pool' })
  async claim(
    @CurrentRunner() runnerId: string,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<ClaimedWorkResponseDto | undefined> {
    const claimed = await this.commandBus.execute<
      ClaimRunCommand,
      ClaimedWorkDto | null
    >(new ClaimRunCommand(runnerId));

    if (!claimed) {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    return ClaimedWorkHttpMapper.toResponse(claimed);
  }

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

  @Post('runs/:runId/lease')
  @ApiOperation({
    operationId: 'renewLease',
    summary: 'Say the run is still in progress',
    description:
      'The answer carries back whether a person has requested that the run stop, ' +
      'so the heartbeat also tells the runner about a stop.',
  })
  @ApiOkResponse({ type: RenewLeaseResponseDto })
  @ApiNotFoundResponse({
    description:
      'The run is no longer leased by this runner: it ended, was suspended, or its task cancelled it. The runner releases its sandbox.',
  })
  @ApiConflictResponse({
    description:
      'The run kept changing while its lease was renewed; renew again on the next heartbeat.',
  })
  async renewLease(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<RenewLeaseResponseDto> {
    await this.commandBus.execute(new RenewLeaseCommand(runId, runnerId));

    const stop = await this.queryBus.execute<RunStopRequestedQuery, boolean>(
      new RunStopRequestedQuery(runId, runnerId),
    );

    return new RenewLeaseResponseDto(stop);
  }

  @Post('runs/:runId/change-stack-checks/:stackId/lease')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'renewCheckLease',
    summary: 'Say the check of a change stack is still in progress',
    description:
      'The runner with the lease on a check renews that lease while the check runs, ' +
      'so a second runner does not claim a long check. The answer ' +
      'carries back whether the runner should stop checking.',
  })
  @ApiQuery({
    name: 'recheck',
    required: false,
    type: Boolean,
    description:
      'true when the check is the recheck of a replay’s change, as its claim said',
  })
  @ApiOkResponse({ type: RenewCheckLeaseResponseDto })
  @ApiNotFoundResponse({
    description:
      'No such runner, or the check this runner leases is of another run',
  })
  @ApiConflictResponse({
    description: 'The check kept moving on while it was renewed',
  })
  async renewCheckLease(
    @Param('runId') runId: string,
    @Param('stackId') stackId: string,
    @Query('recheck') recheck: string | undefined,
    @CurrentRunner() runnerId: string,
  ): Promise<RenewCheckLeaseResponseDto> {
    const renewal = await this.commandBus.execute<
      RenewCheckLeaseCommand,
      CheckLeaseRenewal
    >(new RenewCheckLeaseCommand(runId, stackId, recheck === 'true', runnerId));

    return new RenewCheckLeaseResponseDto(renewal === 'stop');
  }

  @Post('runs/:runId/image')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordRunImage',
    summary: 'Say which image, by digest, the run’s sandbox started from',
    description:
      'The host pulls the image named for the run just after it claims it, and records the digest it pulled here, so the run shows the environment it had.',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'The run is not leased by this runner' })
  async recordImage(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: RecordRunImageRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordRunImageCommand(runId, runnerId, body?.image ?? ''),
    );
  }

  @Post('runs/:runId/starting-point')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordStartingPoint',
    summary:
      'Say where the run started: the archive it restored and the commit each checkout was at',
    description:
      'The runner reports this once the workspace is restored and its checkouts prepared, before the agent starts, and only for a run that works a task. A later attempt of the same run keeps where the first one started.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'No such run' })
  @ApiConflictResponse({
    description:
      'The run is not leased by this runner on that attempt, works no task, or already started from somewhere else',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'An archive the run could not have restored, a commit that is not a full SHA, or checkouts that are not the run’s own',
  })
  async recordStartingPoint(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: RecordStartingPointRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordStartingPointCommand(
        runId,
        runnerId,
        typeof body?.attempt === 'number' ? body.attempt : Number.NaN,
        typeof body?.archiveId === 'string'
          ? body.archiveId
          : body?.archiveId === null || body?.archiveId === undefined
            ? null
            : '',
        Array.isArray(body?.checkouts)
          ? body.checkouts.map((each: unknown) => startedCheckoutOf(each))
          : null,
      ),
    );
  }

  @Post('runs/:runId/events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'appendRunEvents',
    summary: 'Add to the run’s journal',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'The run is not leased by this runner' })
  async appendEvents(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: AppendRunEventsRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AppendRunJournalCommand(runId, runnerId, body.events),
    );
  }

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

  @Post('runs/:runId/completion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'completeRun',
    summary: 'Report how the agent’s turn ended',
    description:
      'The run leaves its lease. When the turn ended by asking a person (a handover for review, a tool approval or a harness permission put to them), the run is suspended until they answer. The answer requeues it, and the sandbox that keeps its workspace takes it first.',
  })
  @ApiNoContentResponse({ description: 'Turn reported' })
  async complete(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: CompleteRunRequestDto,
  ): Promise<void> {
    await this.commandBus.execute<CompleteRunCommand, void>(
      new CompleteRunCommand(
        runId,
        runnerId,
        body.exitCode,
        body.failed,
        body.message,
        body.handover ?? null,
        body.sessionId ?? null,
        body.stopped ?? false,
        body.setupFailed ?? false,
        body.timedOut ?? false,
      ),
    );
  }
}

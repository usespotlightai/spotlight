import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
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
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';
import { AnswerRemarkCommand } from '@work/application/commands/answer-remark.command';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { DeliverSaidCommand } from '@work/application/commands/deliver-said.command';
import {
  AppendRunJournalCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  RecordRunImageCommand,
  RenewCheckLeaseCommand,
  RenewLeaseCommand,
} from '@work/application/commands/runner.commands';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
import type { HarnessDto } from '@work/application/dto/harness.dto';
import type { PendingMessageDto } from '@work/application/dto/pending-message.dto';
import type { PermissionAnswerDto } from '@work/application/dto/permission-answer.dto';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import type { ToolAnswerDto } from '@work/application/dto/tool-answer.dto';
import type { AttachmentContent } from '@work/application/ports/attachment-store.port';
import type { CheckLeaseRenewal } from '@work/application/ports/check-work.port';
import { HarnessCatalogueQuery } from '@work/application/queries/list-harnesses.query';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { RunStopRequestedQuery } from '@work/application/queries/run-stop-requested.query';
import { InstallableHarnessResponseDto } from '@work/presentation/http/dto/installable-harness.response.dto';
import {
  AnswerRemarkRequestDto,
  AppendRunEventsRequestDto,
  AskPermissionRequestDto,
  CompleteRunRequestDto,
  DeliverSaidRequestDto,
  PendingMessageResponseDto,
  RecordRunImageRequestDto,
  RunAttachmentResponseDto,
} from '@work/presentation/http/dto/runner.request.dto';
import {
  ClaimedWorkResponseDto,
  PermissionAnswerResponseDto,
  RenewCheckLeaseResponseDto,
  RenewLeaseResponseDto,
  ToolAnswerResponseDto,
} from '@work/presentation/http/dto/runner.response.dto';
import { TaskTraceResponseDto } from '@work/presentation/http/dto/task-trace.response.dto';
import { ClaimedWorkHttpMapper } from '@work/presentation/http/mappers/claimed-work.http.mapper';
import { TaskTraceHttpMapper } from '@work/presentation/http/mappers/task-trace.http.mapper';

interface Answerable {
  status(code: number): unknown;
}

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, spent or wrong runner token',
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
    operationId: 'installableHarnesses',
    summary: 'What to look for on this runner, so it can say what it has',
  })
  @ApiOkResponse({ type: InstallableHarnessResponseDto, isArray: true })
  async harnesses(): Promise<InstallableHarnessResponseDto[]> {
    const harnesses = await this.queryBus.execute<
      HarnessCatalogueQuery,
      HarnessDto[]
    >(new HarnessCatalogueQuery());

    return harnesses.map(
      (harness) =>
        new InstallableHarnessResponseDto(
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
    summary: 'What a person has said to the agent working this run',
  })
  @ApiOkResponse({ type: PendingMessageResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such run held by this runner' })
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
    summary: 'A file the run’s task was given, to lay out in its workspace',
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

  @Post('runs/:runId/messages/delivered')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deliverSaid',
    summary: 'Say what the agent has been given',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'The run is not held by this runner' })
  async delivered(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: DeliverSaidRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeliverSaidCommand(runId, runnerId, body.upTo),
    );
  }

  @Post('runs/:runId/lease')
  @ApiOperation({
    operationId: 'renewLease',
    summary: 'Say the run is still being worked on',
    description:
      'The answer carries back whether a person has asked the run to stop, ' +
      'so the heartbeat doubles as how a stop reaches the runner.',
  })
  @ApiOkResponse({ type: RenewLeaseResponseDto })
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
    summary: 'Say the check of a change stack is still being worked on',
    description:
      'The runner holding a check renews its lease while the check runs, ' +
      'so a long check is not handed to a second runner. The answer ' +
      'carries back whether the runner should stop checking.',
  })
  @ApiOkResponse({ type: RenewCheckLeaseResponseDto })
  @ApiNotFoundResponse({
    description:
      'No such runner, or the check this runner holds is of another run',
  })
  @ApiConflictResponse({
    description: 'The check kept moving on while it was renewed',
  })
  async renewCheckLease(
    @Param('runId') runId: string,
    @Param('stackId') stackId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<RenewCheckLeaseResponseDto> {
    const renewal = await this.commandBus.execute<
      RenewCheckLeaseCommand,
      CheckLeaseRenewal
    >(new RenewCheckLeaseCommand(runId, stackId, runnerId));

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
  @ApiConflictResponse({ description: 'The run is not held by this runner' })
  async recordImage(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: RecordRunImageRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordRunImageCommand(runId, runnerId, body?.image ?? ''),
    );
  }

  @Post('runs/:runId/events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'appendRunEvents',
    summary: 'Add to the run’s journal',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'The run is not held by this runner' })
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
    summary: 'Do what a tool the run was given does',
    description:
      'The input and the answer are the tool\u2019s own. Only for a tool the ' +
      'run was given; any credential it needs is added by Spotlight, never ' +
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
  @ApiForbiddenResponse({ description: 'The run was not given this tool' })
  @ApiNotFoundResponse({
    description: 'No such run, station or tool for this runner',
  })
  @ApiConflictResponse({ description: 'The run works no task to use it on' })
  @ApiUnprocessableEntityResponse({
    description: 'What the agent handed the tool is not what it takes',
  })
  @ApiBadGatewayResponse({
    description: 'The integration the tool calls refused',
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

    return new ToolAnswerResponseDto(answered.output);
  }

  @Post('runs/:runId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'askPermission',
    summary: 'Ask whether the harness may do what it asked to',
    description:
      'Only for a run whose station names a harness profile. An approval the ' +
      'task already holds for this exact call is spent on it; otherwise a ' +
      'person is asked in their inbox and the run lets the task go.',
  })
  @ApiOkResponse({ type: PermissionAnswerResponseDto })
  @ApiConflictResponse({ description: 'The run is not held by this runner' })
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

  @Post('runs/:runId/remark')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'answerRemark',
    summary: 'Answer something said on the pull request, and resolve it',
    description:
      'Answered under Spotlight\u2019s own credential. Nothing that reaches ' +
      'GitHub is ever sent to a runner.',
  })
  @ApiNoContentResponse()
  async answerRemark(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: AnswerRemarkRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AnswerRemarkCommand(
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
    summary: 'Report what the run produced',
  })
  @ApiNoContentResponse()
  async complete(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: CompleteRunRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new CompleteRunCommand(
        runId,
        runnerId,
        body.exitCode,
        body.failed,
        body.message,
        body.outcome ?? null,
        body.sessionId ?? null,
        body.stopped ?? false,
      ),
    );
  }
}

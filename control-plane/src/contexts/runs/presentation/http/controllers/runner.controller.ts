import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AcceptsLargeBody } from '@platform/http/decorators/accepts-large-body.decorator';
import { CurrentMachine } from '@platform/http/decorators/current-machine.decorator';
import { RecordsMachineHeartbeat } from '@platform/http/decorators/machine-heartbeat.decorator';
import { MachineOnly } from '@platform/http/decorators/machine-only.decorator';
import {
  AppendRunJournalCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  RecordRunImageCommand,
  RecordStartingPointCommand,
  RenewCheckLeaseCommand,
  RenewLeaseCommand,
} from '@runs/application/commands/runner.commands';
import type { HarnessDto } from '@runs/application/dto/harness.dto';
import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import type { CheckLeaseRenewal } from '@runs/application/ports/check-work.port';
import { HarnessCatalogueQuery } from '@runs/application/queries/list-harnesses.query';
import { RunStopRequestedQuery } from '@runs/application/queries/run-stop-requested.query';
import { HarnessProbeResponseDto } from '@runs/presentation/http/dto/harness-probe.response.dto';
import {
  AppendRunEventsRequestDto,
  CompleteRunRequestDto,
  RecordRunImageRequestDto,
  RecordStartingPointRequestDto,
} from '@runs/presentation/http/dto/runner.request.dto';
import {
  ClaimedWorkResponseDto,
  RenewCheckLeaseResponseDto,
  RenewLeaseResponseDto,
} from '@runs/presentation/http/dto/runner.response.dto';
import { ClaimedWorkHttpMapper } from '@runs/presentation/http/mappers/claimed-work.http.mapper';

const textAt = (raw: unknown, key: string): string => {
  const value =
    raw !== null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)[key]
      : undefined;

  return typeof value === 'string' ? value : '';
};

const attemptIn = (body: RecordStartingPointRequestDto | undefined): number => {
  if (typeof body?.attempt !== 'number') {
    throw new UnprocessableEntityException('attempt must be a number');
  }

  return body.attempt;
};

const archiveIdIn = (
  body: RecordStartingPointRequestDto | undefined,
): string | null => {
  const archiveId: unknown = body?.archiveId;

  if (archiveId === null || archiveId === undefined) {
    return null;
  }
  if (typeof archiveId !== 'string') {
    throw new UnprocessableEntityException('archiveId must be text or null');
  }

  return archiveId;
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
@MachineOnly()
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
  @RecordsMachineHeartbeat()
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
    @CurrentMachine() runnerId: string,
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

  @Post('runs/:runId/lease')
  @RecordsMachineHeartbeat()
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
      'The run is no longer leased by this runner: it ended, was suspended, or its requester cancelled it. The runner releases its sandbox.',
  })
  @ApiConflictResponse({
    description:
      'The run kept changing while its lease was renewed; renew again on the next heartbeat.',
  })
  async renewLease(
    @Param('runId') runId: string,
    @CurrentMachine() runnerId: string,
  ): Promise<RenewLeaseResponseDto> {
    await this.commandBus.execute(new RenewLeaseCommand(runId, runnerId));

    const stop = await this.queryBus.execute<RunStopRequestedQuery, boolean>(
      new RunStopRequestedQuery(runId, runnerId),
    );

    return new RenewLeaseResponseDto(stop);
  }

  @Post('runs/:runId/change-stack-checks/:stackId/lease')
  @RecordsMachineHeartbeat()
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
    description: 'true when the check is a repeat check, as its claim said',
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
    @CurrentMachine() runnerId: string,
  ): Promise<RenewCheckLeaseResponseDto> {
    const renewal = await this.commandBus.execute<
      RenewCheckLeaseCommand,
      CheckLeaseRenewal
    >(new RenewCheckLeaseCommand(runId, stackId, recheck === 'true', runnerId));

    return new RenewCheckLeaseResponseDto(renewal === 'stop');
  }

  @Post('runs/:runId/image')
  @RecordsMachineHeartbeat()
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
    @CurrentMachine() runnerId: string,
    @Body() body: RecordRunImageRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordRunImageCommand(runId, runnerId, body?.image ?? ''),
    );
  }

  @Post('runs/:runId/starting-point')
  @RecordsMachineHeartbeat()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordStartingPoint',
    summary:
      'Say where the run started: the archive it restored and the commit each checkout was at',
    description:
      'The runner reports this once the workspace is restored and its checkouts prepared, before the agent starts, and only for a run whose spec asks for its starting point. A later attempt of the same run keeps where the first one started.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'No such run' })
  @ApiConflictResponse({
    description:
      'The run is not leased by this runner on that attempt, its spec asks for no starting point, or it already started from somewhere else',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'An archive the run could not have restored, a commit that is not a full SHA, or checkouts that are not the run’s own',
  })
  async recordStartingPoint(
    @Param('runId') runId: string,
    @CurrentMachine() runnerId: string,
    @Body() body: RecordStartingPointRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordStartingPointCommand(
        runId,
        runnerId,
        attemptIn(body),
        archiveIdIn(body),
        Array.isArray(body?.checkouts)
          ? body.checkouts.map((each: unknown) => startedCheckoutOf(each))
          : null,
      ),
    );
  }

  @AcceptsLargeBody()
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
    @CurrentMachine() runnerId: string,
    @Body() body: AppendRunEventsRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AppendRunJournalCommand(runId, runnerId, body.events),
    );
  }

  @AcceptsLargeBody()
  @Post('runs/:runId/completion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'completeRun',
    summary: 'Report how the agent’s turn ended',
    description:
      'The run leaves its lease. When the run hands over and its requester holds the turn, the run is suspended until the requester finishes, keeps or resumes it. A resume requeues it, and the sandbox that keeps its workspace takes it first.',
  })
  @ApiNoContentResponse({ description: 'Turn reported' })
  async complete(
    @Param('runId') runId: string,
    @CurrentMachine() runnerId: string,
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

import {
  AppendRunEventsCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  RegisterRunnerCommand,
  RenewLeaseCommand,
} from '@application/commands/runner.commands';
import type { HarnessDto } from '@application/dto/harness.dto';
import type {
  ClaimedRunDto,
  RegisteredRunnerDto,
} from '@application/dto/run.dto';
import { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { ListKeptWorkspacesQuery } from '@application/queries/list-kept-workspaces.query';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@presentation/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@presentation/http/decorators/runner-only.decorator';
import { InstallableHarnessResponseDto } from '@presentation/http/dto/installable-harness.response.dto';
import { KeptWorkspacesResponseDto } from '@presentation/http/dto/kept-workspaces.response.dto';
import {
  AppendRunEventsRequestDto,
  CompleteRunRequestDto,
  RegisterRunnerRequestDto,
} from '@presentation/http/dto/runner.request.dto';
import {
  ClaimedRunResponseDto,
  RegisteredRunnerResponseDto,
} from '@presentation/http/dto/runner.response.dto';

/**
 * Only what setting an empty answer needs. Typed structurally, since the
 * presentation layer may not import the framework's own response.
 */
interface Answerable {
  status(code: number): unknown;
}

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'Missing or wrong enrollment token' })
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
      ListHarnessesQuery,
      HarnessDto[]
    >(new ListHarnessesQuery());

    return harnesses.map(
      (harness) =>
        new InstallableHarnessResponseDto(harness.id, harness.executable),
    );
  }

  @Get('runners/workspaces')
  @ApiOperation({
    operationId: 'keptWorkspaces',
    summary: 'Which workspaces this runner should still be holding',
    description:
      'A run keeps its directory so the next one at the same station can ' +
      'take up the conversation left in it. Nothing else ever will, so what ' +
      'this does not name may be disposed of.',
  })
  @ApiOkResponse({ type: KeptWorkspacesResponseDto })
  async workspaces(
    @CurrentRunner() runnerId: string,
  ): Promise<KeptWorkspacesResponseDto> {
    const keys = await this.queryBus.execute<ListKeptWorkspacesQuery, string[]>(
      new ListKeptWorkspacesQuery(runnerId),
    );

    return { keys };
  }

  @Post('runners/register')
  @ApiOperation({
    operationId: 'registerRunner',
    summary: 'Check in, so the control plane knows this runner is there',
  })
  @ApiOkResponse({ type: RegisteredRunnerResponseDto })
  async register(
    @CurrentRunner() runnerId: string,
    @Body() body: RegisterRunnerRequestDto,
  ): Promise<RegisteredRunnerResponseDto> {
    const registered = await this.commandBus.execute<
      RegisterRunnerCommand,
      RegisteredRunnerDto
    >(new RegisterRunnerCommand(runnerId, body.harnesses ?? []));

    return new RegisteredRunnerResponseDto(registered.runnerId);
  }

  @Post('runners/claim')
  @ApiOperation({
    operationId: 'claimRun',
    summary: 'Long-poll for work, answering empty when the queue is',
  })
  @ApiOkResponse({ type: ClaimedRunResponseDto })
  @ApiNoContentResponse({ description: 'Nothing queued for this pool' })
  async claim(
    @CurrentRunner() runnerId: string,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<ClaimedRunResponseDto | undefined> {
    const claimed = await this.commandBus.execute<
      ClaimRunCommand,
      ClaimedRunDto | null
    >(new ClaimRunCommand(runnerId));

    if (!claimed) {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    return new ClaimedRunResponseDto(
      claimed.id,
      claimed.spec,
      claimed.leaseExpiresAt,
    );
  }

  @Post('runs/:runId/lease')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'renewLease',
    summary: 'Say the run is still being worked on',
  })
  @ApiNoContentResponse()
  async renewLease(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<void> {
    await this.commandBus.execute(new RenewLeaseCommand(runId, runnerId));
  }

  @Post('runs/:runId/events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'appendRunEvents',
    summary: 'Add to the run’s journal',
  })
  @ApiNoContentResponse()
  async appendEvents(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: AppendRunEventsRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AppendRunEventsCommand(runId, runnerId, body.events),
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
      ),
    );
  }
}

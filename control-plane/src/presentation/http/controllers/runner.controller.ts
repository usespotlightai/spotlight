import {
  AppendRunEventsCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  RegisterRunnerCommand,
  RenewLeaseCommand,
} from '@application/commands/runner.commands';
import type {
  ClaimedRunDto,
  RegisteredRunnerDto,
} from '@application/dto/run.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RunnerOnly } from '@presentation/http/decorators/runner-only.decorator';
import {
  AppendRunEventsRequestDto,
  CompleteRunRequestDto,
  RegisterRunnerRequestDto,
} from '@presentation/http/dto/runner.request.dto';
import {
  ClaimedRunResponseDto,
  RegisteredRunnerResponseDto,
} from '@presentation/http/dto/runner.response.dto';

const RUNNER_HEADER = 'x-spotlight-runner';

/**
 * Only what setting an empty answer needs. Typed structurally, since the
 * presentation layer may not import the framework's own response.
 */
interface Answerable {
  status(code: number): unknown;
}

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'Missing or wrong enrollment token' })
@ApiHeader({ name: RUNNER_HEADER, required: false })
@RunnerOnly()
@Controller()
export class RunnerController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('runners')
  @ApiOperation({
    operationId: 'registerRunner',
    summary: 'Announce a runner and what it can serve',
  })
  @ApiOkResponse({ type: RegisteredRunnerResponseDto })
  async register(
    @Body() body: RegisterRunnerRequestDto,
  ): Promise<RegisteredRunnerResponseDto> {
    const registered = await this.commandBus.execute<
      RegisterRunnerCommand,
      RegisteredRunnerDto
    >(new RegisterRunnerCommand(body.pool, body.labels ?? {}));

    return new RegisteredRunnerResponseDto(registered.runnerId);
  }

  @Post('runners/:runnerId/claim')
  @ApiOperation({
    operationId: 'claimRun',
    summary: 'Long-poll for work, answering empty when the queue is',
  })
  @ApiOkResponse({ type: ClaimedRunResponseDto })
  @ApiNoContentResponse({ description: 'Nothing queued for this pool' })
  async claim(
    @Param('runnerId') runnerId: string,
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
    @Headers(RUNNER_HEADER) runnerId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new RenewLeaseCommand(runId, this.identify(runnerId)),
    );
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
    @Headers(RUNNER_HEADER) runnerId: string,
    @Body() body: AppendRunEventsRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new AppendRunEventsCommand(runId, this.identify(runnerId), body.events),
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
    @Headers(RUNNER_HEADER) runnerId: string,
    @Body() body: CompleteRunRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new CompleteRunCommand(
        runId,
        this.identify(runnerId),
        body.exitCode,
        body.failed,
        body.message,
      ),
    );
  }

  /**
   * Every runner shares one enrollment token, so the header is what says which
   * of them is calling. It is a claim, not a credential: the run's record of
   * who holds it is what authorises.
   */
  private identify(runnerId: string | undefined): string {
    if (!runnerId) {
      throw new BadRequestException(`${RUNNER_HEADER} is required`);
    }
    return runnerId;
  }
}

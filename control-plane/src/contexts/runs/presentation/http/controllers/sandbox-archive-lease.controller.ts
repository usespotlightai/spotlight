import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { bearerIn } from '@platform/http/bearer';
import { AcceptsLargeBody } from '@platform/http/decorators/accepts-large-body.decorator';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { InAudience } from '@platform/http/decorators/in-audience.decorator';
import {
  AppendSandboxArchiveJournalCommand,
  HoldSandboxArchiveCommand,
  ReleaseSandboxArchiveCommand,
} from '@runs/application/commands/working-copy-archive.commands';
import {
  AppendRunEventsRequestDto,
  HoldSandboxArchiveLeaseRequestDto,
} from '@runs/presentation/http/dto/runner.request.dto';

const UNKNOWN =
  'Missing, wrong or no longer valid sandbox token, or not this sandbox';

@ApiTags('runners')
@ApiBearerAuth()
@AllowAnonymous()
@InAudience('hosts')
@Controller('sandboxes/:sandboxId/archive-leases/:runId')
export class SandboxArchiveLeaseController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'holdSandboxArchiveLease',
    summary:
      'Hold the sandbox for the archive of a run’s workspace: it takes no other run until the lease is released or expires',
    description:
      'The bearer is the sandbox token. Take the lease for the attempt in its turn, while the run holds the sandbox, before the run reports the turn. Renew it with the same call and attempt; it expires 2 minutes after the last call.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: `${UNKNOWN}, a run the sandbox does not hold, or no lease of this attempt to renew`,
  })
  @ApiConflictResponse({
    description: 'The run does not archive a working copy for a later run',
  })
  async hold(
    @Param('sandboxId') sandboxId: string,
    @Param('runId') runId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: HoldSandboxArchiveLeaseRequestDto,
  ): Promise<void> {
    const held = await this.commandBus.execute<
      HoldSandboxArchiveCommand,
      boolean
    >(
      new HoldSandboxArchiveCommand(
        sandboxId,
        bearerIn(authorization),
        runId,
        body.attempt,
      ),
    );

    if (!held) {
      throw new NotFoundException(
        `${UNKNOWN}, a run the sandbox does not hold, or no lease of this attempt to renew`,
      );
    }
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'releaseSandboxArchiveLease',
    summary:
      'Release the sandbox after the archive is sealed or failed, so it takes its next run',
  })
  @ApiQuery({
    name: 'attempt',
    type: Number,
    description: 'The attempt the lease was held for',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: UNKNOWN })
  async release(
    @Param('sandboxId') sandboxId: string,
    @Param('runId') runId: string,
    @Query('attempt', ParseIntPipe) attempt: number,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<void> {
    const released = await this.commandBus.execute<
      ReleaseSandboxArchiveCommand,
      boolean
    >(
      new ReleaseSandboxArchiveCommand(
        sandboxId,
        bearerIn(authorization),
        runId,
        attempt,
      ),
    );

    if (!released) {
      throw new NotFoundException(UNKNOWN);
    }
  }

  @AcceptsLargeBody()
  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'appendSandboxArchiveEvents',
    summary:
      'Add the archive step to the journal of the attempt the sandbox holds an archive lease for',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: `${UNKNOWN}, or no archive lease for this run`,
  })
  @ApiConflictResponse({ description: 'The attempt has not reported its turn' })
  async appendEvents(
    @Param('sandboxId') sandboxId: string,
    @Param('runId') runId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AppendRunEventsRequestDto,
  ): Promise<void> {
    const appended = await this.commandBus.execute<
      AppendSandboxArchiveJournalCommand,
      boolean
    >(
      new AppendSandboxArchiveJournalCommand(
        sandboxId,
        bearerIn(authorization),
        runId,
        body.events,
      ),
    );

    if (!appended) {
      throw new NotFoundException(
        `${UNKNOWN}, or no archive lease for this run`,
      );
    }
  }
}

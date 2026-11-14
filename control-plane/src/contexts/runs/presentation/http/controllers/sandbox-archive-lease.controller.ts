import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
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
import { AppendSandboxArchiveEventsRequestDto } from '@runs/presentation/http/dto/runner.request.dto';

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
      'The bearer is the sandbox token. Take the lease while the run holds the sandbox, before the run reports its turn. Renew it with the same call; it expires 2 minutes after the last call.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: `${UNKNOWN}, or a run the sandbox does not hold`,
  })
  @ApiConflictResponse({
    description: 'The run does not archive a working copy for a later run',
  })
  async hold(
    @Param('sandboxId') sandboxId: string,
    @Param('runId') runId: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<void> {
    const held = await this.commandBus.execute<
      HoldSandboxArchiveCommand,
      boolean
    >(new HoldSandboxArchiveCommand(sandboxId, bearerIn(authorization), runId));

    if (!held) {
      throw new NotFoundException(
        `${UNKNOWN}, or a run the sandbox does not hold`,
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
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: UNKNOWN })
  async release(
    @Param('sandboxId') sandboxId: string,
    @Param('runId') runId: string,
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
      'Add the archive step to the journal of the attempt that reported the turn the sandbox holds an archive lease for',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: `${UNKNOWN}, no archive lease for this run, or an unknown attempt`,
  })
  @ApiConflictResponse({ description: 'The attempt has not reported its turn' })
  async appendEvents(
    @Param('sandboxId') sandboxId: string,
    @Param('runId') runId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AppendSandboxArchiveEventsRequestDto,
  ): Promise<void> {
    const appended = await this.commandBus.execute<
      AppendSandboxArchiveJournalCommand,
      boolean
    >(
      new AppendSandboxArchiveJournalCommand(
        sandboxId,
        bearerIn(authorization),
        runId,
        body.attempt,
        body.events,
      ),
    );

    if (!appended) {
      throw new NotFoundException(
        `${UNKNOWN}, no archive lease for this run, or an unknown attempt`,
      );
    }
  }
}

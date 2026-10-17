import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { bearerIn, TRUST_HEADER } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import {
  LeaveAsHostCommand,
  ReportHostPresenceCommand,
} from '@runners/application/commands/host.commands';
import type {
  HostHeartbeatDto,
  HostLeftDto,
} from '@runners/application/dto/host-heartbeat.dto';
import { HostHeartbeatResponseDto } from '@runners/presentation/http/dto/host-heartbeat.response.dto';
import { HostPresenceRequestDto } from '@runners/presentation/http/dto/host-presence.request.dto';

const UNAUTHORIZED =
  'Pool token is missing, rotated or unknown, or no trust admits this workload.';

@ApiTags('runners')
@ApiBearerAuth()
@ApiHeader({
  name: 'Spotlight-Trust',
  required: false,
  description:
    'The runner trust to claim through; the bearer is then the workload’s token',
})
@ApiUnauthorizedResponse({ description: UNAUTHORIZED })
@ApiParam({ name: 'hostId', example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' })
@AllowAnonymous()
@Controller('hosts/:hostId')
export class HostController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put()
  @ApiOperation({
    operationId: 'reportHostPresence',
    summary:
      'A host says it is here, what it has and what it runs, so the Runners page can show it',
  })
  @ApiOkResponse({ type: HostHeartbeatResponseDto })
  @ApiConflictResponse({
    description: 'The host id serves another pool or trust',
  })
  async present(
    @Param('hostId') hostId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
    @Body() body: HostPresenceRequestDto,
  ): Promise<HostHeartbeatResponseDto> {
    const heartbeat = await this.commandBus.execute<
      ReportHostPresenceCommand,
      HostHeartbeatDto
    >(
      new ReportHostPresenceCommand(
        { bearer: bearerIn(authorization), trust },
        hostId,
        body?.session ?? '',
        {
          name: body?.name ?? '',
          release: body?.release ?? '',
          executor: body?.executor ?? '',
          capacity: body?.capacity ?? 0,
          running: body?.running ?? [],
          images: (body?.images ?? []).map((each) => ({
            image: each.image ?? '',
            usual: each.usual === true,
            harnesses: (each.harnesses ?? []).map((harness) => ({
              id: harness.id,
              models: harness.models ?? [],
              ...(harness.version ? { version: harness.version } : {}),
            })),
            ...(each.digest ? { digest: each.digest } : {}),
            ...(each.release ? { release: each.release } : {}),
            ...(each.unavailableReason
              ? { unavailableReason: each.unavailableReason }
              : {}),
          })),
        },
      ),
    );

    if (heartbeat.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (heartbeat.outcome === 'taken') {
      throw new ConflictException({
        reason: 'host-taken',
        message: `Host ${hostId} is serving another pool or trust. Please stop it there, or give it its own state directory.`,
      });
    }

    return new HostHeartbeatResponseDto(heartbeat.workspaceId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'leaveAsHost',
    summary: 'A host that is stopping says so, and leaves the Runners page',
  })
  @ApiNoContentResponse({ description: 'Gone' })
  async leave(
    @Param('hostId') hostId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
  ): Promise<void> {
    const left = await this.commandBus.execute<LeaveAsHostCommand, HostLeftDto>(
      new LeaveAsHostCommand(
        { bearer: bearerIn(authorization), trust },
        hostId,
      ),
    );

    if (left.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }
  }
}

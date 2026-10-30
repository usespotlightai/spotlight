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
  DeregisterHostCommand,
  HostHeartbeatCommand,
} from '@runners/application/commands/host.commands';
import type {
  HostDeregisteredDto,
  HostHeartbeatDto,
} from '@runners/application/dto/host-heartbeat.dto';
import { HostHeartbeatRequestDto } from '@runners/presentation/http/dto/host-heartbeat.request.dto';
import { HostHeartbeatResponseDto } from '@runners/presentation/http/dto/host-heartbeat.response.dto';

const UNAUTHORIZED =
  'Pool token is missing, rotated or unknown, or no trust accepts this workload.';

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
    operationId: 'hostHeartbeat',
    summary:
      'A host sends a heartbeat with what it has and what it runs, and learns which of its sandboxes to drain',
  })
  @ApiOkResponse({ type: HostHeartbeatResponseDto })
  @ApiConflictResponse({
    description: 'The host id is in use by another pool or trust',
  })
  async heartbeat(
    @Param('hostId') hostId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
    @Body() body: HostHeartbeatRequestDto,
  ): Promise<HostHeartbeatResponseDto> {
    const heartbeat = await this.commandBus.execute<
      HostHeartbeatCommand,
      HostHeartbeatDto
    >(
      new HostHeartbeatCommand(
        { bearer: bearerIn(authorization), trust },
        hostId,
        body?.bootId ?? '',
        {
          name: body?.name ?? '',
          release: body?.release ?? '',
          containerRuntime: body?.containerRuntime ?? '',
          capacity: body?.capacity ?? 0,
          running: body?.running ?? [],
          images: (body?.images ?? []).map((each) => ({
            image: each.image ?? '',
            isDefault: each.isDefault === true,
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
        (body?.sandboxes ?? []).flatMap((each) =>
          typeof each?.id === 'string' && each.id.length > 0 ? [each.id] : [],
        ),
        body?.stopping === true,
      ),
    );

    if (heartbeat.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    if (heartbeat.outcome === 'host-in-use') {
      throw new ConflictException({
        reason: 'host-in-use',
        message: `Host ${hostId} is in use by another pool or trust. Please stop it there, or give it its own state directory.`,
      });
    }

    return new HostHeartbeatResponseDto(heartbeat.workspaceId, heartbeat.drain);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deregisterHost',
    summary:
      'A host that stops deregisters itself, so the Runners page no longer shows it',
  })
  @ApiNoContentResponse({ description: 'Deregistered' })
  async deregister(
    @Param('hostId') hostId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers(TRUST_HEADER) trust: string | undefined,
  ): Promise<void> {
    const deregistered = await this.commandBus.execute<
      DeregisterHostCommand,
      HostDeregisteredDto
    >(
      new DeregisterHostCommand(
        { bearer: bearerIn(authorization), trust },
        hostId,
      ),
    );

    if (deregistered.outcome === 'unauthorized') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }
  }
}

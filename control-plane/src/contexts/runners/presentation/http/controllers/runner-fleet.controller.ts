import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { DeleteHostCommand } from '@runners/application/commands/host.commands';
import type { HostDeletedDto } from '@runners/application/dto/host-heartbeat.dto';
import type { RunnerFleetDto } from '@runners/application/dto/runner-fleet.dto';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { RunnerFleetResponseDto } from '@runners/presentation/http/dto/runner-fleet.response.dto';
import { RunnerFleetHttpMapper } from '@runners/presentation/http/mappers/runner-fleet.http.mapper';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'slug', example: 'acme' })
@Controller('workspaces/:slug/runners')
export class RunnerFleetController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listRunners',
    summary:
      'The hosts serving the workspace’s pools and trusts, and every runner at work now',
  })
  @ApiOkResponse({ type: RunnerFleetResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunnerFleetResponseDto> {
    const fleet = await this.queryBus.execute<
      ListRunnersQuery,
      RunnerFleetDto | null
    >(new ListRunnersQuery(slug, user.id));

    if (!fleet) {
      throw new NotFoundException();
    }

    return RunnerFleetHttpMapper.toResponse(fleet);
  }

  @Delete('hosts/:hostId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deleteHost',
    summary:
      'Remove a host from the Runners page. A host that still sends heartbeats comes back',
  })
  @ApiParam({ name: 'hostId', example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiForbiddenResponse({ description: 'The caller does not manage runners' })
  @ApiNotFoundResponse({ description: 'No such host in this workspace' })
  async deleteHost(
    @Param('slug') slug: string,
    @Param('hostId') hostId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    const deleted = await this.commandBus.execute<
      DeleteHostCommand,
      HostDeletedDto | null
    >(new DeleteHostCommand(slug, hostId, principal));

    if (!deleted) {
      throw new NotFoundException();
    }

    if (deleted.outcome === 'forbidden') {
      throw new ForbiddenException();
    }
  }
}

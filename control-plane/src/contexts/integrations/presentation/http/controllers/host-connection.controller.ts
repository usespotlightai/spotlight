import { DisconnectHostCommand } from '@integrations/application/commands/disconnect-host.command';
import { SetPersonToolRuleCommand } from '@integrations/application/commands/set-person-tool-rule.command';
import type { HostConnectionsDto } from '@integrations/application/dto/host-connections.dto';
import { ListHostConnectionsQuery } from '@integrations/application/queries/list-host-connections.query';
import { HostConnectionsResponseDto } from '@integrations/presentation/http/dto/host-connections.response.dto';
import { SetToolRuleRequestDto } from '@integrations/presentation/http/dto/set-tool-rule.request.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('integrations')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller()
export class HostConnectionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('teams/:teamId/connections')
  @ApiOperation({
    operationId: 'listConnections',
    summary:
      'List the connections the caller made in this team, and for admins who else has connected what',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: HostConnectionsResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HostConnectionsResponseDto> {
    const listed = await this.queryBus.execute<
      ListHostConnectionsQuery,
      HostConnectionsDto | null
    >(new ListHostConnectionsQuery(teamId, user.id));

    if (!listed) {
      throw new NotFoundException();
    }

    return new HostConnectionsResponseDto(listed);
  }

  @Delete('teams/:teamId/integrations/:source/connections/mine')
  @ApiOperation({
    operationId: 'disconnectMine',
    summary: 'Remove the connection the caller made to this integration',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'source', example: 'linear' })
  @ApiNoContentResponse({ description: 'The caller’s connection is gone' })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @Param('teamId') teamId: string,
    @Param('source') source: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const removed = await this.commandBus.execute<
      DisconnectHostCommand,
      boolean
    >(new DisconnectHostCommand(teamId, source, user.id));

    if (!removed) {
      throw new NotFoundException();
    }
  }

  @Put('teams/:teamId/integrations/:source/connections/mine/tools/:tool')
  @ApiOperation({
    operationId: 'setMyToolRule',
    summary:
      'Set what the caller asks of calls a tool makes with their own connection: allowed, needs-approval or blocked',
    description:
      'The stricter of the team’s rule and the caller’s wins, so this can ask first or block where the team allows, but never lets through a call the team asks about.',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'source', example: 'linear' })
  @ApiParam({ name: 'tool', example: 'linear.comment' })
  @ApiNoContentResponse({ description: 'The rule is set' })
  @ApiNotFoundResponse({
    description:
      'No such team for this caller, or the integration offers no such tool',
  })
  @ApiUnprocessableEntityResponse({ description: 'No such rule' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async setToolRule(
    @Param('teamId') teamId: string,
    @Param('source') source: string,
    @Param('tool') tool: string,
    @Body() body: SetToolRuleRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const set = await this.commandBus.execute<
      SetPersonToolRuleCommand,
      boolean
    >(
      new SetPersonToolRuleCommand(
        teamId,
        source,
        tool,
        body?.rule ?? '',
        user.id,
      ),
    );

    if (!set) {
      throw new NotFoundException();
    }
  }
}

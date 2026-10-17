import { DisconnectIntegrationCommand } from '@integrations/application/commands/disconnect-integration.command';
import { SetPersonToolRuleCommand } from '@integrations/application/commands/set-person-tool-rule.command';
import type { IntegrationConnectionsDto } from '@integrations/application/dto/integration-connections.dto';
import { ListIntegrationConnectionsQuery } from '@integrations/application/queries/list-integration-connections.query';
import { IntegrationConnectionsResponseDto } from '@integrations/presentation/http/dto/integration-connections.response.dto';
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
export class IntegrationConnectionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('teams/:teamId/connections')
  @ApiOperation({
    operationId: 'listIntegrationConnections',
    summary:
      'List the connections the caller made in this team, and for admins who else has connected what',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: IntegrationConnectionsResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationConnectionsResponseDto> {
    const listed = await this.queryBus.execute<
      ListIntegrationConnectionsQuery,
      IntegrationConnectionsDto | null
    >(new ListIntegrationConnectionsQuery(teamId, user.id));

    if (!listed) {
      throw new NotFoundException();
    }

    return new IntegrationConnectionsResponseDto(listed);
  }

  @Delete('teams/:teamId/integrations/:integration/connections/mine')
  @ApiOperation({
    operationId: 'disconnectIntegration',
    summary: 'Remove the connection the caller made to this integration',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'integration', example: 'linear' })
  @ApiNoContentResponse({ description: 'The caller’s connection is gone' })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @Param('teamId') teamId: string,
    @Param('integration') integration: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const removed = await this.commandBus.execute<
      DisconnectIntegrationCommand,
      boolean
    >(new DisconnectIntegrationCommand(teamId, integration, user.id));

    if (!removed) {
      throw new NotFoundException();
    }
  }

  @Put('teams/:teamId/integrations/:integration/connections/mine/tools/:tool')
  @ApiOperation({
    operationId: 'setMyToolRule',
    summary:
      'Set what the caller requires of calls a tool makes with their own connection: allowed, needs-approval or blocked',
    description:
      'The stricter of the team’s rule and the caller’s wins, so this can ask first or block where the team allows, but never lets through a call the team asks about.',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'integration', example: 'linear' })
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
    @Param('integration') integration: string,
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
        integration,
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

import type { TeamIntegrationsDto } from '@integrations/application/dto/team-integrations.dto';
import { TeamIntegrationsQuery } from '@integrations/application/queries/team-integrations.query';
import {
  ConfigurationResponseDto,
  IntegrationViewResponseDto,
} from '@integrations/presentation/http/dto/team-configuration.response.dto';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

const shown = (read: TeamIntegrationsDto): ConfigurationResponseDto =>
  new ConfigurationResponseDto(
    read.integrations.map((each) => new IntegrationViewResponseDto(each)),
  );

@ApiTags('configuration')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/configuration')
export class TeamConfigurationController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readConfiguration',
    summary: 'The integrations of this team and their connection status',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: ConfigurationResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConfigurationResponseDto> {
    const read = await this.queryBus.execute<
      TeamIntegrationsQuery,
      TeamIntegrationsDto | null
    >(new TeamIntegrationsQuery(teamId, user.id));

    if (!read) {
      throw new NotFoundException();
    }

    return shown(read);
  }
}

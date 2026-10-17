import type { ConfigurationDto } from '@configuration/application/dto/configuration.dto';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import {
  ConfigurationResponseDto,
  IntegrationViewResponseDto,
} from '@configuration/presentation/http/dto/configuration.response.dto';
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
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const shown = (read: ConfigurationDto): ConfigurationResponseDto =>
  new ConfigurationResponseDto(
    read.integrations.map((each) => new IntegrationViewResponseDto(each)),
  );

@ApiTags('configuration')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/configuration')
export class ConfigurationController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readConfiguration',
    summary: 'What this team listens to',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: ConfigurationResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConfigurationResponseDto> {
    const read = await this.queryBus.execute<
      ConfigurationQuery,
      ConfigurationDto | null
    >(new ConfigurationQuery(teamId, user.id));

    if (!read) {
      throw new NotFoundException();
    }

    return shown(read);
  }
}

import { ChooseIntegrationsCommand } from '@configuration/application/commands/choose-integrations.command';
import { MoveConfigurationCommand } from '@configuration/application/commands/move-configuration.command';
import { PinConfigurationCommand } from '@configuration/application/commands/pin-configuration.command';
import { ReadConfigurationCommand } from '@configuration/application/commands/read-configuration.command';
import type {
  ConfigurationDto,
  ConfigurationMoveDto,
} from '@configuration/application/dto/configuration.dto';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import type { Read } from '@configuration/application/services/read-configuration.service';
import {
  ChooseIntegrationsRequestDto,
  ConfigurationResponseDto,
  ConfiguredConnectionResponseDto,
  ConfiguredIntegrationResponseDto,
  MoveConfigurationRequestDto,
  MovedConfigurationResponseDto,
  PinConfigurationRequestDto,
} from '@configuration/presentation/http/dto/configuration.response.dto';
import type { OpenedPullRequestDto } from '@github/application/ports/pull-request.port';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
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
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { ProposedResponseDto } from '@platform/http/dto/proposed.response.dto';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const shown = (read: ConfigurationDto): ConfigurationResponseDto =>
  new ConfigurationResponseDto(
    read.repository,
    read.sha,
    read.integrations.map(
      (each) =>
        new ConfiguredIntegrationResponseDto(
          each.source,
          each.name,
          each.path,
          each.connectable,
          each.connection
            ? new ConfiguredConnectionResponseDto(each.connection.handle)
            : null,
        ),
    ),
    read.readsFrom,
    read.movingTo,
  );

@ApiTags('configuration')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/configuration')
export class ConfigurationController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readConfiguration',
    summary: 'What this team listens to, and where it reads that from',
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

  @Post('reread')
  @ApiOperation({
    operationId: 'rereadConfiguration',
    summary: 'Read this team’s configuration from its repository again',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: ConfigurationResponseDto })
  @ApiNotFoundResponse({
    description: 'No such team, or nowhere to read it from',
  })
  async reread(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConfigurationResponseDto> {
    const done = await this.commandBus.execute<
      ReadConfigurationCommand,
      Read | null
    >(new ReadConfigurationCommand(teamId, user.id));

    if (!done) {
      throw new NotFoundException();
    }

    return this.read(teamId, user);
  }

  @Post('repository')
  @ApiOperation({
    operationId: 'pinConfigurationRepository',
    summary: 'Choose the repository this team reads its configuration from',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiNoContentResponse({ description: 'Chosen' })
  @ApiNotFoundResponse({
    description: 'No such team, or not yours to choose for',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async pinRepository(
    @Param('teamId') teamId: string,
    @Body() body: PinConfigurationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const pinned = await this.commandBus.execute<
      PinConfigurationCommand,
      boolean
    >(new PinConfigurationCommand(teamId, body.repository ?? null, user.id));

    if (!pinned) {
      throw new NotFoundException();
    }
  }

  @Post('repository/move')
  @ApiOperation({
    operationId: 'moveConfiguration',
    summary: "Move this team's configuration to a different repository",
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: MovedConfigurationResponseDto })
  @ApiNotFoundResponse({
    description: 'No such team, or not yours to move',
  })
  async moveRepository(
    @Param('teamId') teamId: string,
    @Body() body: MoveConfigurationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MovedConfigurationResponseDto> {
    const moved = await this.commandBus.execute<
      MoveConfigurationCommand,
      ConfigurationMoveDto | null
    >(new MoveConfigurationCommand(teamId, body.repository, user.id));

    if (!moved) {
      throw new NotFoundException();
    }

    return new MovedConfigurationResponseDto(
      moved.kind,
      moved.kind === 'carried' ? moved.pullRequest.url : null,
    );
  }

  @Post('integrations')
  @ApiOperation({
    operationId: 'chooseIntegrations',
    summary:
      'Write and remove configuration for the integrations this team uses',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: ProposedResponseDto })
  @ApiNotFoundResponse({
    description: 'No such team, or nowhere to write it yet',
  })
  async chooseIntegrations(
    @Param('teamId') teamId: string,
    @Body() body: ChooseIntegrationsRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposedResponseDto> {
    const opened = await this.commandBus.execute<
      ChooseIntegrationsCommand,
      OpenedPullRequestDto | null
    >(
      new ChooseIntegrationsCommand(
        teamId,
        body.sources ?? [],
        user.id,
        body.dropped ?? [],
      ),
    );

    if (!opened) {
      throw new NotFoundException();
    }

    return new ProposedResponseDto(opened.url);
  }
}

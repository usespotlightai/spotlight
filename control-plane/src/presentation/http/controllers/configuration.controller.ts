import { ChooseToolsCommand } from '@application/commands/choose-tools.command';
import { ForgetSecretCommand } from '@application/commands/forget-secret.command';
import { PinConfigurationCommand } from '@application/commands/pin-configuration.command';
import { ReadConfigurationCommand } from '@application/commands/read-configuration.command';
import { SetSecretCommand } from '@application/commands/set-secret.command';
import type { ConfigurationDto } from '@application/dto/configuration.dto';
import type { OnboardingDto } from '@application/dto/onboarding.dto';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { OnboardingQuery } from '@application/queries/onboarding.query';
import { ConfigurationQuery } from '@application/queries/read-configuration.query';
import type { Read } from '@application/services/read-configuration.service';
import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import {
  ChooseToolsRequestDto,
  ConfigProblemResponseDto,
  ConfigurationResponseDto,
  ConfiguredHappeningResponseDto,
  ConfiguredIntegrationResponseDto,
  KnownToolResponseDto,
  OnboardingResponseDto,
  PinConfigurationRequestDto,
  ProposedResponseDto,
  SetSecretRequestDto,
  SetupStepResponseDto,
} from '@presentation/http/dto/configuration.response.dto';

const shown = (read: ConfigurationDto): ConfigurationResponseDto =>
  new ConfigurationResponseDto(
    read.repository,
    read.sha,
    read.readAt,
    read.integrations.map(
      (each) =>
        new ConfiguredIntegrationResponseDto(
          each.source,
          each.name,
          each.deliverTo,
          each.secret,
          each.secretSet,
          each.happenings.map(
            (raising) =>
              new ConfiguredHappeningResponseDto(
                raising.happening,
                raising.label,
              ),
          ),
        ),
    ),
    read.problems.map(
      (each) => new ConfigProblemResponseDto(each.path, each.at, each.reason),
    ),
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
    summary: 'What this team listens to, and what is wrong with it',
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

  /**
   * Reads it again from the repository. Ordinarily a push does this; asking
   * is for when somebody would rather not wait, or wants to know why.
   */
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

  /**
   * Says which repository this team reads its configuration from. Worth
   * saying rather than leaving to the rule that guesses, once a workspace
   * has more than one team.
   */
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

  @Get('onboarding')
  @ApiOperation({
    operationId: 'readOnboarding',
    summary: 'What this team still needs, and the tools it may choose',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: OnboardingResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async onboarding(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnboardingResponseDto> {
    const read = await this.queryBus.execute<
      OnboardingQuery,
      OnboardingDto | null
    >(new OnboardingQuery(teamId, user.id));

    if (!read) {
      throw new NotFoundException();
    }

    return new OnboardingResponseDto(
      read.steps.map(
        (each) =>
          new SetupStepResponseDto(
            each.key,
            each.title,
            each.description,
            each.where,
            each.done,
          ),
      ),
      read.installUrl,
      read.connectedToGitHub,
      read.configRepository,
      read.repositoryOwner,
      read.tools.map(
        (each) =>
          new KnownToolResponseDto(
            each.source,
            each.name,
            each.summary,
            each.secretCalled,
            each.chosen,
          ),
      ),
    );
  }

  /**
   * Writes a starting file for each host this team says it uses, and takes
   * away the file of each it no longer does. What comes back is a pull
   * request, not a team already listening.
   */
  @Post('tools')
  @ApiOperation({
    operationId: 'chooseTools',
    summary: 'Write and remove configuration for the tools this team uses',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: ProposedResponseDto })
  @ApiNotFoundResponse({
    description: 'No such team, or nowhere to write it yet',
  })
  async chooseTools(
    @Param('teamId') teamId: string,
    @Body() body: ChooseToolsRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposedResponseDto> {
    const opened = await this.commandBus.execute<
      ChooseToolsCommand,
      OpenedPullRequestDto | null
    >(
      new ChooseToolsCommand(
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

  /**
   * Sets what a workspace's configuration may name but must not hold.
   * Written once: nothing here or anywhere else gives it back.
   */
  @Post('secrets')
  @ApiOperation({
    operationId: 'setSecret',
    summary: 'Set a secret this team’s integrations verify with',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiNoContentResponse({ description: 'Set' })
  @ApiNotFoundResponse({
    description: 'No such team, or not yours to set one on',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async setSecret(
    @Param('teamId') teamId: string,
    @Body() body: SetSecretRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const set = await this.commandBus.execute<SetSecretCommand, boolean>(
      new SetSecretCommand(teamId, body.name, body.value, user.id),
    );

    if (!set) {
      throw new NotFoundException();
    }
  }

  @Delete('secrets/:name')
  @ApiOperation({
    operationId: 'forgetSecret',
    summary: 'Forget a secret, so nothing verifies with it again',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'name', example: 'LINEAR_WEBHOOK_SECRET' })
  @ApiNoContentResponse({ description: 'Forgotten' })
  @ApiNotFoundResponse({
    description: 'No such team, or not yours to change',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgetSecret(
    @Param('teamId') teamId: string,
    @Param('name') name: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const forgotten = await this.commandBus.execute<
      ForgetSecretCommand,
      boolean
    >(new ForgetSecretCommand(teamId, name, user.id));

    if (!forgotten) {
      throw new NotFoundException();
    }
  }
}

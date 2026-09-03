import { ChooseToolsCommand } from '@application/commands/choose-tools.command';
import { ForgetSecretCommand } from '@application/commands/forget-secret.command';
import { ProposeLineCommand } from '@application/commands/propose-line.command';
import { ReadConfigurationCommand } from '@application/commands/read-configuration.command';
import { SetSecretCommand } from '@application/commands/set-secret.command';
import type { ConfigurationDto } from '@application/dto/configuration.dto';
import type { OnboardingDto } from '@application/dto/onboarding.dto';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { OnboardingQuery } from '@application/queries/onboarding.query';
import { ConfigurationQuery } from '@application/queries/read-configuration.query';
import type { Read } from '@application/services/read-configuration.service';
import type { WrittenBack } from '@application/services/write-back-line.service';
import {
  Body,
  ConflictException,
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
  ApiConflictResponse,
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
  ProposedResponseDto,
  SetSecretRequestDto,
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
   * Proposes a line as it now stands on the board. What comes back is a pull
   * request to read, not a change already made: the board is ahead of the
   * repository until somebody merges it.
   */
  @Post('lines/:lineId/propose')
  @ApiOperation({
    operationId: 'proposeLine',
    summary: 'Write this line back to the repository, as a pull request',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'lineId', example: 'line_1' })
  @ApiOkResponse({ type: ProposedResponseDto })
  @ApiNotFoundResponse({ description: 'No such team or line' })
  @ApiConflictResponse({
    description: 'The repository moved while this was being edited',
  })
  async propose(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposedResponseDto> {
    const written = await this.commandBus.execute<
      ProposeLineCommand,
      WrittenBack | null
    >(new ProposeLineCommand(teamId, lineId, user.id));

    if (!written || written.kind === 'nowhere') {
      throw new NotFoundException();
    }

    // Said rather than written over: what is in the repository now has not
    // been looked at, and reading it again is the caller's to ask for.
    if (written.kind === 'moved') {
      throw new ConflictException(
        'The repository has moved since this was last read. Read it again, then propose.',
      );
    }

    return new ProposedResponseDto(written.url);
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
      read.hasRunner,
      read.connectedToGitHub,
      read.hasConfiguration,
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
   * Writes a starting file for each host this team says it uses. What comes
   * back is a pull request, not a team already listening.
   */
  @Post('tools')
  @ApiOperation({
    operationId: 'chooseTools',
    summary: 'Write configuration for the tools this team uses',
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
    >(new ChooseToolsCommand(teamId, body.sources ?? [], user.id));

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

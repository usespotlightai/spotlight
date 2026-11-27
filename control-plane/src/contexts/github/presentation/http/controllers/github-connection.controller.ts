import { ConnectGitHubCommand } from '@github/application/commands/connect-github.command';
import type { GitHubConnectionStatusDto } from '@github/application/dto/github-connection-status.dto';
import type { GitHubInstallationDto } from '@github/application/dto/github-installation.dto';
import { ListGitHubInstallationsQuery } from '@github/application/queries/list-github-installations.query';
import { ReadGitHubQuery } from '@github/application/queries/read-github.query';
import { ConnectGitHubRequestDto } from '@github/presentation/http/dto/connect-github.request.dto';
import { GitHubConnectionStatusResponseDto } from '@github/presentation/http/dto/github-connection-status.response.dto';
import { GitHubInstallationResponseDto } from '@github/presentation/http/dto/github-installation.response.dto';
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
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

@ApiTags('workspaces')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/github')
export class GitHubConnectionController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readGitHub',
    summary:
      'Whether this workspace is connected to GitHub, and where to install the App',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: GitHubConnectionStatusResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async read(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GitHubConnectionStatusResponseDto> {
    const read = await this.queryBus.execute<
      ReadGitHubQuery,
      GitHubConnectionStatusDto | null
    >(new ReadGitHubQuery(slug, user.id));

    if (!read) {
      throw new NotFoundException();
    }

    return new GitHubConnectionStatusResponseDto(
      read.connected,
      read.installUrl,
    );
  }

  @Get('installations')
  @ApiOperation({
    operationId: 'listGitHubInstallations',
    summary:
      'List the installations of the App that the caller can reach on GitHub',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: GitHubInstallationResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async installations(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GitHubInstallationResponseDto[]> {
    const found = await this.queryBus.execute<
      ListGitHubInstallationsQuery,
      GitHubInstallationDto[] | null
    >(new ListGitHubInstallationsQuery(slug, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return found.map(
      (each) =>
        new GitHubInstallationResponseDto(
          each.id,
          each.account,
          each.usedElsewhere,
          each.usedBy,
        ),
    );
  }

  @Post()
  @ApiOperation({
    operationId: 'connectGitHub',
    summary: 'Point this workspace at a GitHub App installation',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiNoContentResponse({ description: 'Connected' })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  @ApiForbiddenResponse({
    description: 'Not an owner or admin, or not an admin of the installation',
  })
  @ApiConflictResponse({
    description: 'Another workspace already uses the installation',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async connect(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ConnectGitHubRequestDto,
  ): Promise<void> {
    const connected = await this.commandBus.execute<
      ConnectGitHubCommand,
      string | null
    >(new ConnectGitHubCommand(slug, user.id, body.installationId));

    if (connected === null) {
      throw new NotFoundException();
    }
  }
}

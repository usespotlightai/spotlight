import { ConnectGitHubCommand } from '@github/application/commands/connect-github.command';
import type { GitHubConnectionStatusDto } from '@github/application/dto/github-connection-status.dto';
import { ReadGitHubQuery } from '@github/application/queries/read-github.query';
import { ConnectGitHubRequestDto } from '@github/presentation/http/dto/connect-github.request.dto';
import { GitHubConnectionStatusResponseDto } from '@github/presentation/http/dto/github-connection-status.response.dto';
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
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

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

  @Post()
  @ApiOperation({
    operationId: 'connectGitHub',
    summary: 'Point this workspace at a GitHub App installation',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiNoContentResponse({ description: 'Connected' })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  @ApiForbiddenResponse({
    description: 'Not an owner or admin, or not your installation',
  })
  @ApiConflictResponse({
    description: 'The installation is already connected to another workspace',
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

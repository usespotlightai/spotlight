import { ConnectGitHubCommand } from '@application/commands/connect-github.command';
import type { AuthenticatedUser } from '@application/ports/session.port';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { ConnectGitHubRequestDto } from '@presentation/http/dto/connect-github.request.dto';

@ApiTags('workspaces')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/github')
export class GitHubConnectionController {
  constructor(private readonly commandBus: CommandBus) {}

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

    // Null rather than thrown, so a workspace someone cannot see is not told
    // apart from one that is not there.
    if (connected === null) {
      throw new NotFoundException();
    }
  }
}

import { ConnectGitHubCommand } from '@github/application/commands/connect-github.command';
import { ConnectGitHubRequestDto } from '@github/presentation/http/dto/connect-github.request.dto';
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
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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

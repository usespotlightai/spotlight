import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { bearerIn } from '@platform/http/bearer';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import {
  CompleteSandboxArchiveCommand,
  GrantSandboxArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import type {
  ArchiveGrantDto,
  SandboxArchiveAnswer,
} from '@work/application/dto/workspace-archive.dto';
import { StoredSandboxArchiveQuery } from '@work/application/queries/stored-workspace-archive.query';
import { GrantWorkspaceArchiveRequestDto } from '@work/presentation/http/dto/workspace-archive.request.dto';
import {
  ArchiveGrantResponseDto,
  StoredArchiveResponseDto,
} from '@work/presentation/http/dto/workspace-archive.response.dto';

interface Answerable {
  status(code: number): unknown;
}

const UNKNOWN =
  'Missing, wrong or no longer valid sandbox token, or not this sandbox';

@ApiTags('runners')
@ApiBearerAuth()
@ApiNotFoundResponse({ description: UNKNOWN })
@AllowAnonymous()
@Controller('sandboxes/:sandboxId/workspace-archive')
export class SandboxArchiveController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readSandboxArchive',
    summary:
      'The archive a sandbox restores when it starts: the newest workspace its task or chat left',
    description:
      'The bearer is the sandbox token from the sandbox’s first assignment.',
  })
  @ApiOkResponse({ type: StoredArchiveResponseDto })
  @ApiNoContentResponse({
    description:
      'Nothing to restore: the sandbox starts with an empty workspace',
  })
  async storedArchive(
    @Param('sandboxId') sandboxId: string,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<StoredArchiveResponseDto | undefined> {
    const answer = await this.queryBus.execute<
      StoredSandboxArchiveQuery,
      SandboxArchiveAnswer
    >(new StoredSandboxArchiveQuery(sandboxId, bearerIn(authorization)));

    if (!answer.known) {
      throw new NotFoundException(UNKNOWN);
    }

    if (!answer.archive) {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    const { id, url, size, sha256 } = answer.archive;

    return new StoredArchiveResponseDto(id, url, size, sha256);
  }

  @Post()
  @ApiOperation({
    operationId: 'grantSandboxArchive',
    summary:
      'Archive the workspace as the sandbox keeps it: a place to upload its archive, for this size and SHA-256 only',
    description:
      'The bearer is the sandbox token. The sandbox archives with it when it drains, also when no run is in it.',
  })
  @ApiCreatedResponse({ type: ArchiveGrantResponseDto })
  @ApiUnprocessableEntityResponse({
    description:
      'Too large, not a SHA-256, a sandbox of no task or chat, or nowhere to store it',
  })
  async grant(
    @Param('sandboxId') sandboxId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: GrantWorkspaceArchiveRequestDto,
  ): Promise<ArchiveGrantResponseDto> {
    const granted = await this.commandBus.execute<
      GrantSandboxArchiveCommand,
      ArchiveGrantDto | null
    >(
      new GrantSandboxArchiveCommand(
        sandboxId,
        bearerIn(authorization),
        body.size,
        body.sha256,
      ),
    );

    if (!granted) {
      throw new NotFoundException(UNKNOWN);
    }

    return new ArchiveGrantResponseDto(
      granted.id,
      granted.url,
      granted.headers,
    );
  }

  @Post(':archiveId/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'completeSandboxArchive',
    summary:
      'Say the archive is uploaded, so the next sandbox or run of this task or chat restores it',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({
    description: 'Not uploaded, or uploaded other than as granted',
  })
  async complete(
    @Param('sandboxId') sandboxId: string,
    @Param('archiveId') archiveId: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<void> {
    const completed = await this.commandBus.execute<
      CompleteSandboxArchiveCommand,
      boolean
    >(
      new CompleteSandboxArchiveCommand(
        sandboxId,
        bearerIn(authorization),
        archiveId,
      ),
    );

    if (!completed) {
      throw new NotFoundException(UNKNOWN);
    }
  }
}

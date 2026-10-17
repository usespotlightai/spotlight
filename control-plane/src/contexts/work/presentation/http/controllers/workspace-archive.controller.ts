import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';
import {
  GrantWorkspaceArchiveCommand,
  SealWorkspaceArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import type {
  ArchiveGrantDto,
  WorkspaceArchiveAnswer,
} from '@work/application/dto/workspace-archive.dto';
import { StoredWorkspaceArchiveQuery } from '@work/application/queries/stored-workspace-archive.query';
import { GrantWorkspaceArchiveRequestDto } from '@work/presentation/http/dto/workspace-archive.request.dto';
import {
  ArchiveGrantResponseDto,
  StoredArchiveResponseDto,
} from '@work/presentation/http/dto/workspace-archive.response.dto';

interface Answerable {
  status(code: number): unknown;
}

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, spent or wrong runner token',
})
@RunnerOnly()
@Controller('runs/:runId/workspace-archive')
export class WorkspaceArchiveController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readWorkspaceArchive',
    summary:
      'The archive to restore before the run starts: the workspace the conversation it carries on was left in',
  })
  @ApiOkResponse({ type: StoredArchiveResponseDto })
  @ApiNoContentResponse({
    description: 'Nothing to restore: the run starts its work afresh',
  })
  @ApiNotFoundResponse({ description: 'Not this runner’s run' })
  async storedArchive(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<StoredArchiveResponseDto | undefined> {
    const answer = await this.queryBus.execute<
      StoredWorkspaceArchiveQuery,
      WorkspaceArchiveAnswer
    >(new StoredWorkspaceArchiveQuery(runId, runnerId));

    if (!answer.leased) {
      throw new NotFoundException();
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
    operationId: 'grantWorkspaceArchive',
    summary:
      'Keep the workspace as the run leaves it: a place to upload its archive, for this size and SHA-256 only',
  })
  @ApiCreatedResponse({ type: ArchiveGrantResponseDto })
  @ApiNotFoundResponse({ description: 'Not this runner’s run' })
  @ApiUnprocessableEntityResponse({
    description:
      'Too large, not a SHA-256, work that does not carry on, or nowhere to keep it',
  })
  async grant(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: GrantWorkspaceArchiveRequestDto,
  ): Promise<ArchiveGrantResponseDto> {
    const granted = await this.commandBus.execute<
      GrantWorkspaceArchiveCommand,
      ArchiveGrantDto | null
    >(
      new GrantWorkspaceArchiveCommand(runId, runnerId, body.size, body.sha256),
    );

    if (!granted) {
      throw new NotFoundException();
    }

    return new ArchiveGrantResponseDto(
      granted.id,
      granted.url,
      granted.headers,
    );
  }

  @Post(':archiveId/sealed')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'sealWorkspaceArchive',
    summary:
      'Say the archive is uploaded, so the next run of this work restores it',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'Not this runner’s run, or not an archive granted to it',
  })
  @ApiConflictResponse({
    description: 'Not uploaded, or uploaded other than as granted',
  })
  async seal(
    @Param('runId') runId: string,
    @Param('archiveId') archiveId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<void> {
    const sealed = await this.commandBus.execute<
      SealWorkspaceArchiveCommand,
      boolean
    >(new SealWorkspaceArchiveCommand(runId, runnerId, archiveId));

    if (!sealed) {
      throw new NotFoundException();
    }
  }
}

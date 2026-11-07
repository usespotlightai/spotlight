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
import { CurrentMachine } from '@platform/http/decorators/current-machine.decorator';
import { MachineOnly } from '@platform/http/decorators/machine-only.decorator';
import {
  CompleteWorkingCopyArchiveCommand,
  GrantWorkingCopyArchiveCommand,
} from '@runs/application/commands/working-copy-archive.commands';
import type {
  ArchiveGrantDto,
  WorkingCopyArchiveAnswer,
} from '@runs/application/dto/working-copy-archive.dto';
import { StoredWorkingCopyArchiveQuery } from '@runs/application/queries/stored-working-copy-archive.query';
import { GrantWorkingCopyArchiveRequestDto } from '@runs/presentation/http/dto/working-copy-archive.request.dto';
import {
  ArchiveGrantResponseDto,
  StoredArchiveResponseDto,
} from '@runs/presentation/http/dto/working-copy-archive.response.dto';

interface Answerable {
  status(code: number): unknown;
}

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@MachineOnly()
@Controller('runs/:runId/working-copy-archive')
export class WorkingCopyArchiveController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readWorkingCopyArchive',
    summary:
      'The archive to restore before the run starts: the working copy the conversation it carries on was left in',
  })
  @ApiOkResponse({ type: StoredArchiveResponseDto })
  @ApiNoContentResponse({
    description: 'Nothing to restore: the run starts its work afresh',
  })
  @ApiNotFoundResponse({ description: 'Not this runner’s run' })
  async storedArchive(
    @Param('runId') runId: string,
    @CurrentMachine() runnerId: string,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<StoredArchiveResponseDto | undefined> {
    const answer = await this.queryBus.execute<
      StoredWorkingCopyArchiveQuery,
      WorkingCopyArchiveAnswer
    >(new StoredWorkingCopyArchiveQuery(runId, runnerId));

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
    operationId: 'grantWorkingCopyArchive',
    summary:
      'Archive the working copy as the run leaves it: a place to upload its archive, for this size and SHA-256 only',
  })
  @ApiCreatedResponse({ type: ArchiveGrantResponseDto })
  @ApiNotFoundResponse({ description: 'Not this runner’s run' })
  @ApiUnprocessableEntityResponse({
    description:
      'Too large, not a SHA-256, work that does not carry on, or nowhere to store it',
  })
  async grant(
    @Param('runId') runId: string,
    @CurrentMachine() runnerId: string,
    @Body() body: GrantWorkingCopyArchiveRequestDto,
  ): Promise<ArchiveGrantResponseDto> {
    const granted = await this.commandBus.execute<
      GrantWorkingCopyArchiveCommand,
      ArchiveGrantDto | null
    >(
      new GrantWorkingCopyArchiveCommand(
        runId,
        runnerId,
        body.size,
        body.sha256,
      ),
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

  @Post(':archiveId/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'completeWorkingCopyArchive',
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
  async complete(
    @Param('runId') runId: string,
    @Param('archiveId') archiveId: string,
    @CurrentMachine() runnerId: string,
  ): Promise<void> {
    const completed = await this.commandBus.execute<
      CompleteWorkingCopyArchiveCommand,
      boolean
    >(new CompleteWorkingCopyArchiveCommand(runId, runnerId, archiveId));

    if (!completed) {
      throw new NotFoundException();
    }
  }
}

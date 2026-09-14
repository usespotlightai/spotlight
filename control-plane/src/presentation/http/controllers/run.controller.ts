import { EnqueueRunCommand } from '@application/commands/runner.commands';
import type { EnqueuedRunDto } from '@application/dto/run.dto';
import type { WorkspaceDto } from '@application/dto/workspace.dto';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { EnqueueRunRequestDto } from '@presentation/http/dto/runner.request.dto';
import { EnqueuedRunResponseDto } from '@presentation/http/dto/runner.response.dto';

@ApiTags('runs')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/runs')
export class RunController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    operationId: 'enqueueRun',
    summary: 'Queue a run for a pool to pick up',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiCreatedResponse({ type: EnqueuedRunResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async enqueue(
    @Param('slug') slug: string,
    @Body() body: EnqueueRunRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnqueuedRunResponseDto> {
    const workspace = await this.queryBus.execute<
      GetWorkspaceQuery,
      WorkspaceDto | null
    >(new GetWorkspaceQuery(slug, user.id));

    if (!workspace) {
      throw new NotFoundException();
    }

    const queued = await this.commandBus.execute<
      EnqueueRunCommand,
      EnqueuedRunDto
    >(
      new EnqueueRunCommand(
        workspace.id,
        body.harness,
        body.spec,
        body.targetRunnerId ?? null,
      ),
    );

    return new EnqueuedRunResponseDto(
      queued.id,
      queued.harness,
      queued.state,
      queued.targetRunnerId,
    );
  }
}

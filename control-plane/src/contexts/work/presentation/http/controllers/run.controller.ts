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
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import { EnqueueRunCommand } from '@work/application/commands/runner.commands';
import type { EnqueuedRunDto } from '@work/application/dto/run.dto';
import { EnqueueRunRequestDto } from '@work/presentation/http/dto/runner.request.dto';
import { EnqueuedRunResponseDto } from '@work/presentation/http/dto/runner.response.dto';

@ApiTags('runs')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/runs')
export class RunController {
  constructor(
    private readonly commandBus: CommandBus,
    readonly _queryBus: QueryBus,
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
    const queued = await this.commandBus.execute<
      EnqueueRunCommand,
      EnqueuedRunDto | null
    >(
      new EnqueueRunCommand(
        slug,
        user.id,
        body.harness,
        body.spec,
        body.targetRunnerId ?? null,
      ),
    );

    if (!queued) {
      throw new NotFoundException();
    }

    return new EnqueuedRunResponseDto(
      queued.id,
      queued.harness,
      queued.state,
      queued.targetRunnerId,
    );
  }
}

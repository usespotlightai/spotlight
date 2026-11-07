import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { EnqueueRunCommand } from '@work/application/commands/runner.commands';
import type { EnqueuedRunDto } from '@work/application/dto/run.dto';
import { EnqueueRunRequestDto } from '@work/presentation/http/dto/runner.request.dto';
import { EnqueuedRunResponseDto } from '@work/presentation/http/dto/runner.response.dto';

@ApiTags('runs')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/runs')
export class RunController {
  constructor(private readonly commandBus: CommandBus) {}

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
    >(new EnqueueRunCommand(slug, user.id, body.harness, body.spec));

    if (!queued) {
      throw new NotFoundException();
    }

    return new EnqueuedRunResponseDto(queued.id, queued.harness, queued.state);
  }
}

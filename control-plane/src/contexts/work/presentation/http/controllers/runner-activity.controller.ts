import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import type { RunnerActivityDto } from '@work/application/dto/runner-activity.dto';
import { ListRunnerActivityQuery } from '@work/application/queries/list-runner-activity.query';
import {
  HeldRunResponseDto,
  RunnerActivityResponseDto,
} from '@work/presentation/http/dto/runner-activity.response.dto';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/runner-activity')
export class RunnerActivityController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listRunnerActivity',
    summary: 'Which run each of the workspace’s runners is working on',
    description: 'A runner that holds no run is idle, and is not listed.',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: RunnerActivityResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunnerActivityResponseDto[]> {
    const activity = await this.queryBus.execute<
      ListRunnerActivityQuery,
      RunnerActivityDto[] | null
    >(new ListRunnerActivityQuery(slug, user.id));

    if (!activity) {
      throw new NotFoundException();
    }

    return activity.map(
      (each) =>
        new RunnerActivityResponseDto(
          each.runnerId,
          new HeldRunResponseDto(each.currentRun.id, each.currentRun.state),
        ),
    );
  }
}

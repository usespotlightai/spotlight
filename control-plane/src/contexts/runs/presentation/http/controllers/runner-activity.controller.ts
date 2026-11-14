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
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { RunnerActivityDto } from '@runs/application/dto/runner-activity.dto';
import { ListRunnerActivityQuery } from '@runs/application/queries/list-runner-activity.query';
import { RunnerActivityResponseDto } from '@runs/presentation/http/dto/runner-activity.response.dto';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/runner-activity')
export class RunnerActivityController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listRunnerActivity',
    summary:
      'The run each busy runner works on, and the last run of each idle sandbox',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: RunnerActivityResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunnerActivityResponseDto> {
    const activity = await this.queryBus.execute<
      ListRunnerActivityQuery,
      RunnerActivityDto | null
    >(new ListRunnerActivityQuery(slug, user.id));

    if (!activity) {
      throw new NotFoundException();
    }

    return new RunnerActivityResponseDto(activity);
  }
}

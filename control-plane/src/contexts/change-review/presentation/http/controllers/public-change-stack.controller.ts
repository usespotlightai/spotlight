import type { PublicChangeStacksDto } from '@change-review/application/dto/change-stack.dto';
import { ListPublicRunChangeStacksQuery } from '@change-review/application/queries/list-public-run-change-stacks.query';
import { ListPublicTaskChangeStacksQuery } from '@change-review/application/queries/list-public-task-change-stacks.query';
import { PublicChangeStacksResponseDto } from '@change-review/presentation/http/dto/public-change-stack.response.dto';
import { ChangeStackHttpMapper } from '@change-review/presentation/http/mappers/change-stack.http.mapper';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { InAudience } from '@platform/http/decorators/in-audience.decorator';

const NOT_PUBLIC =
  'The change stack does not exist, or a repository in it is not public';

@ApiTags('public-change-stacks')
@AllowAnonymous()
@InAudience('web')
@Controller('public')
export class PublicChangeStackController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('runs/:runId/change-stacks')
  @ApiOperation({
    operationId: 'listPublicRunChangeStacks',
    summary:
      'The change stacks of a run, for anybody, when every repository in them is public on GitHub',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: PublicChangeStacksResponseDto })
  @ApiNotFoundResponse({ description: NOT_PUBLIC })
  async runChangeStacks(
    @Param('runId') runId: string,
  ): Promise<PublicChangeStacksResponseDto> {
    const found = await this.queryBus.execute<
      ListPublicRunChangeStacksQuery,
      PublicChangeStacksDto | null
    >(new ListPublicRunChangeStacksQuery(runId));

    if (!found) {
      throw new NotFoundException('Change stacks not found.');
    }

    return ChangeStackHttpMapper.toPublicResponse(found);
  }

  @Get('tasks/:taskId/change-stacks')
  @ApiOperation({
    operationId: 'listPublicTaskChangeStacks',
    summary:
      'The newest change stack of each repository of a task, for anybody, when every repository in them is public on GitHub',
  })
  @ApiParam({ name: 'taskId', type: String })
  @ApiOkResponse({ type: PublicChangeStacksResponseDto })
  @ApiNotFoundResponse({ description: NOT_PUBLIC })
  async taskChangeStacks(
    @Param('taskId') taskId: string,
  ): Promise<PublicChangeStacksResponseDto> {
    const found = await this.queryBus.execute<
      ListPublicTaskChangeStacksQuery,
      PublicChangeStacksDto | null
    >(new ListPublicTaskChangeStacksQuery(taskId));

    if (!found) {
      throw new NotFoundException('Change stacks not found.');
    }

    return ChangeStackHttpMapper.toPublicResponse(found);
  }
}

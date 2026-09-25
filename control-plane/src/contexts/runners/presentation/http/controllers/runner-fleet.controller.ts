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
import type { RunnerFleetDto } from '@runners/application/dto/runner-fleet.dto';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { RunnerFleetResponseDto } from '@runners/presentation/http/dto/runner-fleet.response.dto';
import { RunnerFleetHttpMapper } from '@runners/presentation/http/mappers/runner-fleet.http.mapper';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'slug', example: 'acme' })
@Controller('workspaces/:slug/runners')
export class RunnerFleetController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listRunners',
    summary:
      'The hosts serving the workspace’s pools and trusts, and every runner at work now',
  })
  @ApiOkResponse({ type: RunnerFleetResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunnerFleetResponseDto> {
    const fleet = await this.queryBus.execute<
      ListRunnersQuery,
      RunnerFleetDto | null
    >(new ListRunnersQuery(slug, user.id));

    if (!fleet) {
      throw new NotFoundException();
    }

    return RunnerFleetHttpMapper.toResponse(fleet);
  }
}

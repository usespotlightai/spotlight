import type { RepositorySummary } from '@github/application/ports/repository-catalog.port';
import { ListRepositoriesQuery } from '@github/application/queries/list-repositories.query';
import { RepositoryResponseDto } from '@github/presentation/http/dto/repository.response.dto';
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

@ApiTags('repositories')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/repositories')
export class RepositoryController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listRepositories',
    summary: 'List the repositories a task can be raised against',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: RepositoryResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RepositoryResponseDto[]> {
    const found = await this.queryBus.execute<
      ListRepositoriesQuery,
      RepositorySummary[] | null
    >(new ListRepositoriesQuery(slug, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return found.map((each) => new RepositoryResponseDto(each.fullName));
  }
}

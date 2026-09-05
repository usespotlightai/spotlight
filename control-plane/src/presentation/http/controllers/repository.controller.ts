import type { RepositorySummary } from '@application/ports/repository-catalog.port';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { ListRepositoriesQuery } from '@application/queries/list-repositories.query';
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
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { RepositoryResponseDto } from '@presentation/http/dto/repository.response.dto';

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

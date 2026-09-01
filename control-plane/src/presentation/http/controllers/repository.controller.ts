import type { RepositorySummary } from '@application/ports/repository-catalog.port';
import { ListRepositoriesQuery } from '@application/queries/list-repositories.query';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RepositoryResponseDto } from '@presentation/http/dto/repository.response.dto';

@ApiTags('repositories')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('repositories')
export class RepositoryController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listRepositories',
    summary: 'List the repositories a task can be raised against',
  })
  @ApiOkResponse({ type: RepositoryResponseDto, isArray: true })
  async list(): Promise<RepositoryResponseDto[]> {
    const found = await this.queryBus.execute<
      ListRepositoriesQuery,
      RepositorySummary[]
    >(new ListRepositoriesQuery());

    return found.map((each) => new RepositoryResponseDto(each.fullName));
  }
}

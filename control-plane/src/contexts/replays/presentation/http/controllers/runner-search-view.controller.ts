import { Controller, Get, HttpStatus, Param, UseFilters } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentMachine } from '@platform/http/decorators/current-machine.decorator';
import { MachineOnly } from '@platform/http/decorators/machine-only.decorator';
import { ProblemResponseDto } from '@platform/http/dto/problem.response.dto';
import { ApiProblemResponse } from '@platform/http/resources/conventional-api';
import { ProblemFilter } from '@platform/http/resources/problem.filter';
import type { SearchViewDto } from '@replays/application/dto/search-view.dto';
import { ReadSearchViewQuery } from '@replays/application/queries/read-search-view.query';
import { SearchViewResponseDto } from '@replays/presentation/http/dto/search-view.response.dto';

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@ApiExtraModels(ProblemResponseDto)
@UseFilters(ProblemFilter)
@MachineOnly()
@Controller('runs/:runId/search-view')
export class RunnerSearchViewController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readSearchView',
    summary:
      'Read what a search’s agent run may see of its search: the candidates proposed so far, their replay runs, and the station block it started from',
  })
  @ApiOkResponse({ type: SearchViewResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'This run is no longer the active run of the search, or it is not a search run that this runner leases',
  )
  async read(
    @Param('runId') runId: string,
    @CurrentMachine() runnerId: string,
  ): Promise<SearchViewResponseDto> {
    return new SearchViewResponseDto(
      await this.queryBus.execute<ReadSearchViewQuery, SearchViewDto>(
        new ReadSearchViewQuery(runId, runnerId),
      ),
    );
  }
}

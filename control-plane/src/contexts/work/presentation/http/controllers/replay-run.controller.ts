import { Get, HttpStatus, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { respondFound } from '@platform/http/resources/resource-responses';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { ReplayRunDto } from '@work/application/dto/replay-run.dto';
import type { SearchRunDto } from '@work/application/dto/search-run.dto';
import { ReadReplayRunQuery } from '@work/application/queries/read-replay-run.query';
import { ReadSearchRunQuery } from '@work/application/queries/read-search-run.query';
import { ReplayRunResponseDto } from '@work/presentation/http/dto/replay-run.response.dto';
import { SearchRunResponseDto } from '@work/presentation/http/dto/search-run.response.dto';

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
export class ReplayRunController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('replay-runs/:runId')
  @ApiOperation({
    operationId: 'readReplayRun',
    summary:
      'A replay run: the past run it replays, what it did and wrote, and what it spent',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: ReplayRunResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No such replay run of the team for a caller who may read its insights',
  )
  async replayRun(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayRunResponseDto> {
    return respondFound(
      'replay run',
      await this.queryBus.execute<ReadReplayRunQuery, ReplayRunDto | null>(
        new ReadReplayRunQuery(teamId, runId, principal),
      ),
      (run) => new ReplayRunResponseDto(run),
    );
  }

  @Get('search-runs/:runId')
  @ApiOperation({
    operationId: 'readSearchRun',
    summary:
      'A search’s agent run: its search and iteration, the agent it ran, what it did and wrote, and what it spent',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: SearchRunResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No such search run of the team for a caller who may read it',
  )
  async searchRun(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SearchRunResponseDto> {
    return respondFound(
      'search run',
      await this.queryBus.execute<ReadSearchRunQuery, SearchRunDto | null>(
        new ReadSearchRunQuery(teamId, runId, principal),
      ),
      (run) => new SearchRunResponseDto(run),
    );
  }
}

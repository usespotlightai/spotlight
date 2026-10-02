import { Get, HttpStatus, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { found } from '@platform/http/resources/resource-answers';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { ReplayRunDto } from '@work/application/dto/replay-run.dto';
import { ReadReplayRunQuery } from '@work/application/queries/read-replay-run.query';
import { ReplayRunResponseDto } from '@work/presentation/http/dto/replay-run.response.dto';

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
export class ReplayRunController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('replay-runs/:runId')
  @ApiOperation({
    operationId: 'readReplayRun',
    summary:
      'A replay run: the past run it replays, what it did and said, and what it spent',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: ReplayRunResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No such replay run of the team for a caller who may read its outcomes',
  )
  async replayRun(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayRunResponseDto> {
    return found(
      'replay run',
      await this.queryBus.execute<ReadReplayRunQuery, ReplayRunDto | null>(
        new ReadReplayRunQuery(teamId, runId, principal),
      ),
      (run) => new ReplayRunResponseDto(run),
    );
  }
}

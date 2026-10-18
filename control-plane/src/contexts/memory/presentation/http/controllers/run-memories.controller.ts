import type { RunMemoriesDto } from '@memory/application/dto/team-memory.dto';
import { ReadRunMemoriesQuery } from '@memory/application/queries/read-run-memories.query';
import { RunMemoriesResponseDto } from '@memory/presentation/http/dto/run-memories.response.dto';
import { Controller, Get, Param } from '@nestjs/common';
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

@ApiTags('memories')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'runId', type: String })
@Controller('teams/:teamId/runs/:runId/memories')
export class RunMemoriesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readRunMemories',
    summary:
      'What a run remembered: the memories it was briefed with and those the cap omitted, what it recalled, and what it proposed',
  })
  @ApiOkResponse({ type: RunMemoriesResponseDto })
  @ApiNotFoundResponse({
    description: 'No such run of this team for this caller',
  })
  async read(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunMemoriesResponseDto> {
    return new RunMemoriesResponseDto(
      await this.queryBus.execute<ReadRunMemoriesQuery, RunMemoriesDto>(
        new ReadRunMemoriesQuery(teamId, runId, user.id),
      ),
    );
  }
}

import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import { ReadBriefedMemoriesQuery } from '@memory/application/queries/read-briefed-memories.query';
import { TeamMemoryResponseDto } from '@memory/presentation/http/dto/team-memory.response.dto';
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
@Controller('teams/:teamId/runs/:runId/briefed-memories')
export class BriefedMemoriesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readBriefedMemories',
    summary:
      'The memories a run was briefed with, in the order it was told them',
  })
  @ApiOkResponse({ type: TeamMemoryResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async briefed(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamMemoryResponseDto[]> {
    const briefed = await this.queryBus.execute<
      ReadBriefedMemoriesQuery,
      TeamMemoryDto[]
    >(new ReadBriefedMemoriesQuery(teamId, runId, user.id));

    return briefed.map((each) => new TeamMemoryResponseDto(each));
  }
}

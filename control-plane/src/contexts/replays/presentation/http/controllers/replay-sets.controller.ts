import {
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaySetDto } from '@replays/application/dto/replays.dto';
import { ListTeamReplaySetsQuery } from '@replays/application/queries/list-team-replay-sets.query';
import { ReadReplaySetQuery } from '@replays/application/queries/read-replay-set.query';
import {
  allowed,
  keyedIn,
} from '@replays/presentation/http/controllers/requests';
import { ReplaySetResponseDto } from '@replays/presentation/http/dto/replay-sets.response.dto';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const SET = 'replay set';

const STATION = 'lines/:lineId/stations/:stationId';

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(
  HttpStatus.NOT_FOUND,
  'No such team, station, set or run for this caller, or the station has no replay set yet',
)
export class ReplaySetsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(`${STATION}/replay-set`)
  @ApiOperation({
    operationId: 'readReplaySet',
    summary:
      'The replay set Spotlight keeps for the station, each run in it, and whether it can still be replayed',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiOkResponse({ type: ReplaySetResponseDto })
  async read(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplaySetResponseDto> {
    return new ReplaySetResponseDto(
      await this.queryBus.execute<ReadReplaySetQuery, ReplaySetDto>(
        new ReadReplaySetQuery(teamId, lineId, stationId, principal),
      ),
    );
  }

  @Get('replay-sets')
  @ApiOperation({
    operationId: 'listTeamReplaySets',
    summary:
      'Every replay set of the team, including those whose station is gone from its line; or only the set of one station, named by its line and key',
  })
  @ApiQuery({
    name: 'line',
    required: false,
    example: '3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03',
    description: 'With station: the line of the station whose set to list',
  })
  @ApiQuery({
    name: 'station',
    required: false,
    example: 'build',
    description:
      'With line: the key of the station whose set to list; a line or station that the team does not own is not found',
  })
  @ApiOkResponse({ type: ReplaySetResponseDto, isArray: true })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'A line without a station, or a station without a line',
  )
  async listOfTeam(
    @Param('teamId') teamId: string,
    @Query('line') line: string | undefined,
    @Query('station') station: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplaySetResponseDto[]> {
    const sets = await this.queryBus.execute<
      ListTeamReplaySetsQuery,
      readonly ReplaySetDto[]
    >(new ListTeamReplaySetsQuery(teamId, principal, keyedIn(line, station)));

    return sets.map((each) => new ReplaySetResponseDto(each));
  }

  @Delete('replay-sets/:setId/entries/:runId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'removeReplaySetEntry',
    summary:
      'Take a run out of a replay set; Spotlight never adds a run of its task to the set again',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiParam({ name: 'runId', type: String })
  @ApiNoContentResponse({ description: 'Removed' })
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async remove(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    allowed(
      SET,
      await this.commandBus.execute<RemoveReplaySetEntryCommand, SetChanged>(
        new RemoveReplaySetEntryCommand(teamId, setId, runId, principal),
      ),
    );
  }
}

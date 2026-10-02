import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { AddReplaySetEntryCommand } from '@replays/application/commands/add-replay-set-entry.command';
import { DeleteReplaySetCommand } from '@replays/application/commands/delete-replay-set.command';
import { GuardChangesCommand } from '@replays/application/commands/guard-changes.command';
import { OpenReplaySetCommand } from '@replays/application/commands/open-replay-set.command';
import { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import { RenameReplaySetCommand } from '@replays/application/commands/rename-replay-set.command';
import type {
  SetChanged,
  SetDeleted,
  SetOpened,
} from '@replays/application/dto/replay-outcomes.dto';
import type {
  ReplayableRunDto,
  ReplaySetDto,
} from '@replays/application/dto/replays.dto';
import { ListReplaySetsQuery } from '@replays/application/queries/list-replay-sets.query';
import { ListReplayableRunsQuery } from '@replays/application/queries/list-replayable-runs.query';
import { ListTeamReplaySetsQuery } from '@replays/application/queries/list-team-replay-sets.query';
import {
  allowed,
  keyedIn,
  textAt,
} from '@replays/presentation/http/controllers/requests';
import {
  AddReplaySetEntryRequestDto,
  OpenReplaySetRequestDto,
  RenameReplaySetRequestDto,
  ReplayableRunResponseDto,
  ReplaySetOpenedResponseDto,
  ReplaySetResponseDto,
} from '@replays/presentation/http/dto/replay-sets.response.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const SET = 'replay set';

const NAME_SAYS = 'names the set, in 1 to 100 characters';

const STATION = 'lines/:lineId/stations/:stationId';

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(
  HttpStatus.NOT_FOUND,
  'No such team, station, set or run for this caller',
)
export class ReplaySetsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(`${STATION}/replay-sets`)
  @ApiOperation({
    operationId: 'listReplaySets',
    summary:
      'The station’s replay sets, each run in them, and whether it can still be replayed',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiOkResponse({ type: ReplaySetResponseDto, isArray: true })
  async list(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplaySetResponseDto[]> {
    const sets = await this.queryBus.execute<
      ListReplaySetsQuery,
      readonly ReplaySetDto[]
    >(new ListReplaySetsQuery(teamId, lineId, stationId, principal));

    return sets.map((each) => new ReplaySetResponseDto(each));
  }

  @Get('replay-sets')
  @ApiOperation({
    operationId: 'listTeamReplaySets',
    summary:
      'Every replay set of the team, including those whose station is gone from its line; or only those of one station, named by its line and key',
  })
  @ApiQuery({
    name: 'line',
    required: false,
    example: '3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03',
    description: 'With station: the line of the station whose sets to list',
  })
  @ApiQuery({
    name: 'station',
    required: false,
    example: 'build',
    description:
      'With line: the key of the station whose sets to list; a line or station the team does not hold is not found',
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

  @Get(`${STATION}/replayable-runs`)
  @ApiOperation({
    operationId: 'listReplayableRuns',
    summary:
      'The station’s latest ended task runs to pick a replay set from, saying why any cannot be replayed',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiOkResponse({ type: ReplayableRunResponseDto, isArray: true })
  async replayable(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayableRunResponseDto[]> {
    const runs = await this.queryBus.execute<
      ListReplayableRunsQuery,
      readonly ReplayableRunDto[]
    >(new ListReplayableRunsQuery(teamId, lineId, stationId, principal));

    return runs.map((each) => new ReplayableRunResponseDto(each));
  }

  @Post(`${STATION}/replay-sets`)
  @ApiOperation({
    operationId: 'openReplaySet',
    summary: 'Open an empty replay set at the station',
  })
  @ApiParam({ name: 'lineId', type: String })
  @ApiParam({ name: 'stationId', type: String })
  @ApiBody({ type: OpenReplaySetRequestDto })
  @ApiCreatedResponse({ type: ReplaySetOpenedResponseDto })
  @ApiProblemResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'No name it takes')
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async open(
    @Param('teamId') teamId: string,
    @Param('lineId') lineId: string,
    @Param('stationId') stationId: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplaySetOpenedResponseDto> {
    const opened = allowed(
      SET,
      await this.commandBus.execute<OpenReplaySetCommand, SetOpened>(
        new OpenReplaySetCommand(
          teamId,
          lineId,
          stationId,
          textAt(body, 'name', NAME_SAYS),
          principal,
        ),
      ),
    );

    return new ReplaySetOpenedResponseDto(opened.id);
  }

  @Patch('replay-sets/:setId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'renameReplaySet',
    summary: 'Rename a replay set',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiBody({ type: RenameReplaySetRequestDto })
  @ApiNoContentResponse({ description: 'Renamed' })
  @ApiProblemResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'No name it takes')
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async rename(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    allowed(
      SET,
      await this.commandBus.execute<RenameReplaySetCommand, SetChanged>(
        new RenameReplaySetCommand(
          teamId,
          setId,
          textAt(body, 'name', NAME_SAYS),
          principal,
        ),
      ),
    );
  }

  @Delete('replay-sets/:setId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deleteReplaySet',
    summary:
      'Delete a replay set and its replays, letting go of the archives it kept',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'A replay of the set is still running; stop it first',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async delete(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    allowed(
      SET,
      await this.commandBus.execute<DeleteReplaySetCommand, SetDeleted>(
        new DeleteReplaySetCommand(teamId, setId, principal),
      ),
    );
  }

  @Post('replay-sets/:setId/entries')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'addReplaySetEntry',
    summary:
      'Add a past run of the station to a replay set, keeping the archive it started from while it is there',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiBody({ type: AddReplaySetEntryRequestDto })
  @ApiNoContentResponse({ description: 'Added' })
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The run is in the set already, the set is full, or the run cannot be replayed, saying why',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'No run named, or a run of another station',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async add(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    allowed(
      SET,
      await this.commandBus.execute<AddReplaySetEntryCommand, SetChanged>(
        new AddReplaySetEntryCommand(
          teamId,
          setId,
          textAt(body, 'runId', 'names a past run of the station'),
          principal,
        ),
      ),
    );
  }

  @Delete('replay-sets/:setId/entries/:runId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'removeReplaySetEntry',
    summary: 'Take a run out of a replay set',
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

  @Post('replay-sets/:setId/guards-changes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'guardChanges',
    summary:
      'Check planned changes of the set’s station against this set, as `spotlight replay check` asks; a station has one such set',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiNoContentResponse({ description: 'It guards the station’s changes' })
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'Another set guards the station’s changes already, or the set’s station is gone',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async guard(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    allowed(
      SET,
      await this.commandBus.execute<GuardChangesCommand, SetChanged>(
        new GuardChangesCommand(teamId, setId, true, actor),
      ),
    );
  }

  @Delete('replay-sets/:setId/guards-changes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'unguardChanges',
    summary:
      'Stop checking planned changes of the set’s station against this set; checks already started keep running',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiNoContentResponse({
    description: 'It no longer guards the station’s changes',
  })
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async unguard(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    allowed(
      SET,
      await this.commandBus.execute<GuardChangesCommand, SetChanged>(
        new GuardChangesCommand(teamId, setId, false, actor),
      ),
    );
  }
}

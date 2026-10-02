import { Body, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import { StopReplayCommand } from '@replays/application/commands/stop-replay.command';
import type {
  ReplayStarted,
  ReplayStoppedOutcome,
} from '@replays/application/dto/replay-outcomes.dto';
import type {
  ReplayDetailDto,
  ReplayDto,
  ReplayOfRunDto,
} from '@replays/application/dto/replays.dto';
import { ListReplaysQuery } from '@replays/application/queries/list-replays.query';
import { ReadReplayQuery } from '@replays/application/queries/read-replay.query';
import { ReadReplayOfRunQuery } from '@replays/application/queries/read-replay-of-run.query';
import {
  allowed,
  ceilingIn,
  textAt,
} from '@replays/presentation/http/controllers/requests';
import {
  ReplayDetailResponseDto,
  ReplayOfRunResponseDto,
  ReplayResponseDto,
  ReplayStartedResponseDto,
  StartReplayRequestDto,
} from '@replays/presentation/http/dto/replays.response.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const REPLAY = 'replay';

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(
  HttpStatus.NOT_FOUND,
  'No such team, set, candidate or replay for this caller',
)
export class ReplaysController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('replay-sets/:setId/replays')
  @ApiOperation({
    operationId: 'listReplays',
    summary:
      'Every replay of a set, newest first, with each run’s result and the set’s baseline marked',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiOkResponse({ type: ReplayResponseDto, isArray: true })
  async list(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayResponseDto[]> {
    const replays = await this.queryBus.execute<
      ListReplaysQuery,
      readonly ReplayDto[]
    >(new ListReplaysQuery(teamId, setId, principal));

    return replays.map((each) => new ReplayResponseDto(each));
  }

  @Post('replay-sets/:setId/replays')
  @ApiOperation({
    operationId: 'startReplay',
    summary:
      'Replay a set’s runs under a candidate, or the live config, within a ceiling that applies to this replay on its own',
    description:
      'When the set has no baseline covering its runs, a baseline replay of the live config starts beside it, with a ceiling of its own equal to the one asked for; the answer names it. Replaying live when the set has no baseline makes that replay the baseline.',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiBody({ type: StartReplayRequestDto })
  @ApiCreatedResponse({ type: ReplayStartedResponseDto })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'No candidate named, a ceiling of nothing or more than it takes, or a set with no runs',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async start(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<ReplayStartedResponseDto> {
    const started = allowed(
      REPLAY,
      await this.commandBus.execute<StartReplayCommand, ReplayStarted>(
        new StartReplayCommand(
          teamId,
          setId,
          textAt(body, 'candidate', 'names a candidate, or live'),
          ceilingIn(body),
          actor,
        ),
      ),
    );

    return new ReplayStartedResponseDto(started);
  }

  @Get('replays/:replayId')
  @ApiOperation({
    operationId: 'readReplay',
    summary:
      'One replay, its totals, and each task against the set’s baseline, regressions first',
  })
  @ApiParam({ name: 'replayId', type: String })
  @ApiOkResponse({ type: ReplayDetailResponseDto })
  async read(
    @Param('teamId') teamId: string,
    @Param('replayId') replayId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayDetailResponseDto> {
    return new ReplayDetailResponseDto(
      await this.queryBus.execute<ReadReplayQuery, ReplayDetailDto>(
        new ReadReplayQuery(teamId, replayId, principal),
      ),
    );
  }

  @Get('replay-runs/:runId/replay')
  @ApiOperation({
    operationId: 'readReplayOfRun',
    summary:
      'The replay a replay run belongs to, its candidate and set, and the run’s result in it',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: ReplayOfRunResponseDto })
  async ofRun(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayOfRunResponseDto> {
    return new ReplayOfRunResponseDto(
      await this.queryBus.execute<ReadReplayOfRunQuery, ReplayOfRunDto>(
        new ReadReplayOfRunQuery(teamId, runId, principal),
      ),
    );
  }

  @Post('replays/:replayId/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'stopReplay',
    summary: 'Stop a replay: no more of its runs start, and those running stop',
  })
  @ApiParam({ name: 'replayId', type: String })
  @ApiNoContentResponse({ description: 'Stopped' })
  @ApiProblemResponse(HttpStatus.CONFLICT, 'The replay has already ended')
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async stop(
    @Param('teamId') teamId: string,
    @Param('replayId') replayId: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    allowed(
      REPLAY,
      await this.commandBus.execute<StopReplayCommand, ReplayStoppedOutcome>(
        new StopReplayCommand(teamId, replayId, actor),
      ),
    );
  }
}

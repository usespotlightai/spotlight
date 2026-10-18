import {
  Body,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
} from '@platform/http/resources/conventional-api';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { answerCreated } from '@platform/http/resources/resource-answers';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
} from '@platform/http/resources/resource-headers';
import { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import type {
  ReplayCheckDto,
  ReplayCheckSummaryDto,
} from '@replays/application/dto/replay-checks.dto';
import type { ReplayCheckStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import { ListSetReplayChecksQuery } from '@replays/application/queries/list-set-replay-checks.query';
import { ReadReplayCheckQuery } from '@replays/application/queries/read-replay-check.query';
import {
  referenceIn,
  repeatsIn,
  textAt,
} from '@replays/presentation/http/controllers/requests';
import {
  ReplayCheckResponseDto,
  ReplayCheckSummaryResponseDto,
  StartReplayCheckRequestDto,
} from '@replays/presentation/http/dto/replay-checks.response.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'replay check';

const PAGE = 50;

const LONGEST_PAGE = 200;

interface Answerable {
  status(code: number): unknown;
}

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

const nothingToReplay = (scoringPinnedToLive: readonly string[]): never => {
  throw ProblemException.of({
    slug: 'nothing-to-replay',
    title: 'Planned station runs the same as the live one',
    status: HttpStatus.CONFLICT,
    detail:
      scoringPinnedToLive.length > 0
        ? `There is nothing to replay. A check pins these changed fields to their live values: ${scoringPinnedToLive.join(', ')}`
        : 'There is nothing to replay. The plan changes nothing that affects how the station’s runs go.',
  });
};

@ConventionalApiController('teams/:teamId', 'replays')
@ApiParam({ name: 'teamId', type: String })
@ApiProblemResponse(
  HttpStatus.NOT_FOUND,
  'No such team, station or check for this caller',
)
export class ReplayChecksController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Post('replay-checks')
  @ApiOperation({
    operationId: 'startReplayCheck',
    summary:
      'Check a planned change of a station against the replay set that gates its changes, under the live line’s replay_check; a change already checked against the same live config answers its check',
  })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description:
      'Unique per requested check; a retry with the same key and body answers the check the first attempt started, and starts nothing more',
    schema: { type: 'string', maxLength: 255 },
  })
  @ApiBody({ type: StartReplayCheckRequestDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'The check started, as a read would answer it; or, on a retry with the same Idempotency-Key, the check the first attempt answered',
    type: ReplayCheckResponseDto,
    headers: {
      [IDEMPOTENT_REPLAY_HEADER]: {
        description: 'true when this answers an earlier attempt',
        schema: { type: 'string', enum: ['true'] },
      },
    },
  })
  @ApiOkResponse({
    type: ReplayCheckResponseDto,
    description:
      'The check this change already has against the same live config, set runs and threshold, while it runs, passed or failed; reused is true',
  })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The planned station is not one the line takes, naming each problem',
  )
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The line has no replay_check, no replay set gates the station’s changes, or the plan changes nothing that changes how its runs go (nothing-to-replay)',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'A caller who may read the team but not plan',
  )
  async start(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Answerable,
  ): Promise<ReplayCheckResponseDto> {
    const started = await this.commandBus.execute<
      StartReplayCheckCommand,
      ReplayCheckStartedOutcome
    >(
      new StartReplayCheckCommand(
        teamId,
        {
          lineId: textAt(
            body,
            'lineId',
            'Line ID must name the line of the station.',
          ),
          stationKey: textAt(
            body,
            'stationKey',
            'Station key must be the key of the planned station.',
          ),
          station: fieldsOf(body).station,
          line: fieldsOf(body).line,
          reference: referenceIn(body),
        },
        repeatsIn(body),
        actor,
        key,
      ),
    );

    if (started.outcome === 'unchanged') {
      return nothingToReplay(started.scoringPinnedToLive);
    }

    if (started.outcome === 'reused') {
      response.status(HttpStatus.OK);

      return this.answer(teamId, started.id, actor.principal, true);
    }

    return answerCreated(KIND, started, (id) =>
      this.answer(teamId, id, actor.principal),
    );
  }

  @Get('replay-sets/:setId/replay-checks')
  @ApiOperation({
    operationId: 'listReplaySetChecks',
    summary:
      'The checks of planned changes replayed over a replay set, newest first, a page at a time, with the result of each',
  })
  @ApiParam({ name: 'setId', type: String })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    description:
      'Only checks started before this one, by its id; a check that the set does not contain answers an empty page',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `At most this many, up to ${LONGEST_PAGE}; ${PAGE} unless told`,
  })
  @ApiOkResponse({ type: ReplayCheckSummaryResponseDto, isArray: true })
  async listOfSet(
    @Param('teamId') teamId: string,
    @Param('setId') setId: string,
    @Query('before') before: string | undefined,
    @Query('limit', new ParseIntPipe({ optional: true })) limit:
      | number
      | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayCheckSummaryResponseDto[]> {
    const checks = await this.queryBus.execute<
      ListSetReplayChecksQuery,
      readonly ReplayCheckSummaryDto[]
    >(
      new ListSetReplayChecksQuery(teamId, setId, principal, {
        before: before || null,
        limit: Math.min(Math.max(limit ?? PAGE, 1), LONGEST_PAGE),
      }),
    );

    return checks.map((each) => new ReplayCheckSummaryResponseDto(each));
  }

  @Get('replay-checks/:checkId')
  @ApiOperation({
    operationId: 'readReplayCheck',
    summary:
      'Read a replay check and its result: running, passed, failed or undecided, with the tasks it regressed on and why',
  })
  @ApiParam({ name: 'checkId', type: String })
  @ApiOkResponse({ type: ReplayCheckResponseDto })
  read(
    @Param('teamId') teamId: string,
    @Param('checkId') checkId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayCheckResponseDto> {
    return this.answer(teamId, checkId, principal);
  }

  private async answer(
    teamId: string,
    checkId: string,
    principal: Principal,
    reused = false,
  ): Promise<ReplayCheckResponseDto> {
    return new ReplayCheckResponseDto(
      await this.queryBus.execute<ReadReplayCheckQuery, ReplayCheckDto>(
        new ReadReplayCheckQuery(teamId, checkId, principal),
      ),
      reused,
    );
  }
}

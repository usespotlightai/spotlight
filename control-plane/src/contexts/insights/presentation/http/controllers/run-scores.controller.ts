import { ClearRunVerdictCommand } from '@insights/application/commands/clear-run-verdict.command';
import { RecordRunVerdictCommand } from '@insights/application/commands/record-run-verdict.command';
import type { RunScoresDto } from '@insights/application/dto/run-scores.dto';
import { ReadRunScoresQuery } from '@insights/application/queries/read-run-scores.query';
import {
  RecordRunVerdictRequestDto,
  RunScoresResponseDto,
} from '@insights/presentation/http/dto/run-scores.response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

const rightIn = (body: RecordRunVerdictRequestDto | undefined): boolean => {
  const right: unknown = body?.right;

  if (typeof right !== 'boolean') {
    throw new UnprocessableEntityException(
      'The verdict has no right. It takes true where the run was right and false where it was wrong.',
    );
  }

  return right;
};

const reasonIn = (
  body: RecordRunVerdictRequestDto | undefined,
): string | null => {
  const reason: unknown = body?.reason;

  if (reason === undefined || reason === null) {
    return null;
  }
  if (typeof reason !== 'string') {
    throw new UnprocessableEntityException('The reason is not text.');
  }

  return reason;
};

@ApiTags('insights')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'runId', type: String })
@Controller('teams/:teamId/runs/:runId')
export class RunScoresController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('scores')
  @ApiOperation({
    operationId: 'readRunScores',
    summary:
      'The judge’s verdict on a run, with the reasons it cites, and what people said of the run',
  })
  @ApiOkResponse({ type: RunScoresResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async scores(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunScoresResponseDto> {
    return new RunScoresResponseDto(
      await this.queryBus.execute<ReadRunScoresQuery, RunScoresDto>(
        new ReadRunScoresQuery(teamId, runId, user.id),
      ),
    );
  }

  @Put('verdict')
  @ApiOperation({
    operationId: 'recordRunVerdict',
    summary:
      'Say whether a finished run was right, at any time; the verdict is people’s verdict on the run for the station’s judge and Insights, in place of what people’s actions say, and it never moves the task',
  })
  @ApiBody({ type: RecordRunVerdictRequestDto })
  @ApiOkResponse({ type: RunScoresResponseDto })
  @ApiUnprocessableEntityResponse({
    description:
      'The verdict has no right, the reason is not text, a reason is given for a run that was right, or the reason is over 2,000 characters',
  })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiConflictResponse({
    description:
      'The run has not finished, ended before it ran, or changed meanwhile',
  })
  async recordVerdict(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @Body() body: RecordRunVerdictRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunScoresResponseDto> {
    await this.commandBus.execute<RecordRunVerdictCommand, void>(
      new RecordRunVerdictCommand(
        teamId,
        runId,
        user.id,
        rightIn(body),
        reasonIn(body),
      ),
    );

    return this.scores(teamId, runId, user);
  }

  @Delete('verdict')
  @ApiOperation({
    operationId: 'clearRunVerdict',
    summary:
      'Take back the verdict recorded on a run, so that what people’s actions say counts again',
  })
  @ApiOkResponse({ type: RunScoresResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiConflictResponse({ description: 'The run changed meanwhile' })
  async clearVerdict(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunScoresResponseDto> {
    await this.commandBus.execute<ClearRunVerdictCommand, void>(
      new ClearRunVerdictCommand(teamId, runId, user.id),
    );

    return this.scores(teamId, runId, user);
  }
}

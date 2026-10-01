import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { GradeRunCommand } from '@outcomes/application/commands/grade-run.command';
import type { RunScoresDto } from '@outcomes/application/dto/run-scores.dto';
import { ReadRunScoresQuery } from '@outcomes/application/queries/read-run-scores.query';
import {
  GradeRunRequestDto,
  RunScoresResponseDto,
} from '@outcomes/presentation/http/dto/run-scores.response.dto';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const gradeIn = (
  body: GradeRunRequestDto | undefined,
): boolean | number | null =>
  typeof body?.value === 'boolean' || typeof body?.value === 'number'
    ? body.value
    : null;

@ApiTags('outcomes')
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
      'The judge’s score for a run, with the reasons it cites, and the grades people gave it',
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

  @Post('grades')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'gradeRun',
    summary:
      'Grade a run; a later grade by the same person replaces theirs, and nothing waits on it',
  })
  @ApiBody({ type: GradeRunRequestDto })
  @ApiOkResponse({ type: RunScoresResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'No grade, or one off the run’s scale',
  })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiConflictResponse({ description: 'The grade changed meanwhile' })
  async grade(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @Body() body: GradeRunRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunScoresResponseDto> {
    return new RunScoresResponseDto(
      await this.commandBus.execute<GradeRunCommand, RunScoresDto>(
        new GradeRunCommand(teamId, runId, gradeIn(body), user.id),
      ),
    );
  }
}

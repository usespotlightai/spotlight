import type { RunScoresDto } from '@insights/application/dto/run-scores.dto';
import { ReadRunScoresQuery } from '@insights/application/queries/read-run-scores.query';
import { RunScoresResponseDto } from '@insights/presentation/http/dto/run-scores.response.dto';
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
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

@ApiTags('insights')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'runId', type: String })
@Controller('teams/:teamId/runs/:runId')
export class RunScoresController {
  constructor(private readonly queryBus: QueryBus) {}

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
}

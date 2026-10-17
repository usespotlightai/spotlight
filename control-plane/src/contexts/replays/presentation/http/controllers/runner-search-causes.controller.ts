import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';
import { ProblemResponseDto } from '@platform/http/dto/problem.response.dto';
import { ApiProblemResponse } from '@platform/http/resources/conventional-api';
import { ProblemFilter } from '@platform/http/resources/problem.filter';
import { RecordSearchCauseCommand } from '@replays/application/commands/record-search-cause.command';
import type { SearchCauseRecorded } from '@replays/application/dto/replay-outcomes.dto';
import {
  RecordSearchCauseRequestDto,
  SearchCauseRecordedResponseDto,
} from '@replays/presentation/http/dto/searches.response.dto';

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@ApiExtraModels(ProblemResponseDto)
@UseFilters(ProblemFilter)
@RunnerOnly()
@Controller('runs/:runId/search-causes')
export class RunnerSearchCausesController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    operationId: 'recordSearchCause',
    summary:
      'Record why a failing task failed, from inside the run in which a stalled search looks into why',
    description:
      'One cause per task: recording a task’s cause again replaces the one before. Only the tasks the reflection’s briefing lists take a cause.',
  })
  @ApiBody({ type: RecordSearchCauseRequestDto })
  @ApiCreatedResponse({ type: SearchCauseRecordedResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'This run is no longer the active run of the search, it is not a search run that this runner leases, or the reflection does not look into the task',
  )
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The run proposes candidates; it looks into no causes',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'A cause that is none of config, task, judge, check or infra, no evidence, or text too long',
  )
  async record(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @CurrentRunner() runnerId: string,
  ): Promise<SearchCauseRecordedResponseDto> {
    const { taskId, cause, evidence, suggestion } = fieldsOf(body);
    const recorded = await this.commandBus.execute<
      RecordSearchCauseCommand,
      SearchCauseRecorded
    >(
      new RecordSearchCauseCommand(
        runId,
        runnerId,
        taskId,
        cause,
        evidence,
        suggestion,
      ),
    );

    return new SearchCauseRecordedResponseDto(recorded);
  }
}

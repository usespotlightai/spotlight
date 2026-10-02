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
import { ProblemException } from '@platform/http/resources/problem.exception';
import { ProblemFilter } from '@platform/http/resources/problem.filter';
import { ProposeSearchCandidateCommand } from '@replays/application/commands/propose-search-candidate.command';
import type { SearchCandidateProposed } from '@replays/application/dto/replay-outcomes.dto';
import {
  ProposeSearchCandidateRequestDto,
  SearchCandidateProposedResponseDto,
} from '@replays/presentation/http/dto/searches.response.dto';

const CANDIDATE = 'search candidate';

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, spent or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@ApiExtraModels(ProblemResponseDto)
@UseFilters(ProblemFilter)
@RunnerOnly()
@Controller('runs/:runId/search-candidates')
export class RunnerSearchCandidatesController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    operationId: 'proposeSearchCandidate',
    summary:
      'Propose a candidate from inside a search’s agent run; Spotlight replays it on the search’s searched tasks',
    description:
      'Proposing the same name again from the same run answers with the candidate it proposed. A refused proposal does not count towards the iteration’s candidates, but the run may only try so often.',
  })
  @ApiBody({ type: ProposeSearchCandidateRequestDto })
  @ApiCreatedResponse({ type: SearchCandidateProposedResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'The search no longer holds this run, or it is no search run this runner holds',
  )
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The iteration proposed all the candidates it may, or tried too often, or another iteration took the name',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'A name that is no slug, no hypothesis, or a station block the line refuses or that changes what a search may not; errors name each problem’s path',
  )
  async propose(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @CurrentRunner() runnerId: string,
  ): Promise<SearchCandidateProposedResponseDto> {
    const { name, hypothesis, station } = fieldsOf(body);
    const proposed = await this.commandBus.execute<
      ProposeSearchCandidateCommand,
      SearchCandidateProposed
    >(
      new ProposeSearchCandidateCommand(
        runId,
        runnerId,
        name,
        hypothesis,
        station,
      ),
    );

    if (proposed.outcome === 'invalid') {
      throw ProblemException.invalid(CANDIDATE, proposed.problems);
    }

    return new SearchCandidateProposedResponseDto(proposed);
  }
}

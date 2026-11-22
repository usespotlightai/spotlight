import { RecordRunDecisionsCommand } from '@change-review/application/commands/record-run-decisions.command';
import type { RecordedDecisions } from '@change-review/application/dto/recorded-decisions.dto';
import {
  RecordDecisionsRequestDto,
  RecordedDecisionsResponseDto,
} from '@change-review/presentation/http/dto/runner-decisions.dto';
import { decisionsInput } from '@change-review/presentation/http/mappers/decisions-input';
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
import { CurrentMachine } from '@platform/http/decorators/current-machine.decorator';
import { MachineOnly } from '@platform/http/decorators/machine-only.decorator';
import { ProblemResponseDto } from '@platform/http/dto/problem.response.dto';
import { ApiProblemResponse } from '@platform/http/resources/conventional-api';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { ProblemFilter } from '@platform/http/resources/problem.filter';

const DECISIONS = 'decisions';

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@ApiExtraModels(ProblemResponseDto)
@UseFilters(ProblemFilter)
@MachineOnly()
@Controller('runs/:runId/decisions')
export class RunnerDecisionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    operationId: 'recordDecisions',
    summary:
      'Record decisions the agent made while it worked, for review beside the task’s change',
    description:
      'They join the decisions of the task’s earlier runs, each kept with the run that recorded it. A decision the task holds already is kept once, with the run that first recorded it.',
  })
  @ApiBody({ type: RecordDecisionsRequestDto })
  @ApiCreatedResponse({ type: RecordedDecisionsResponseDto })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Not a run this runner leases')
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The run’s station keeps no decisions, the run works no task of its own or reviews a pull request, the task merged, or it holds as many decisions as it may',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'An unknown kind, a missing or too long text, too many alternatives, or no changed file; errors name each problem’s path',
  )
  async record(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @CurrentMachine() runnerId: string,
  ): Promise<RecordedDecisionsResponseDto> {
    const input = decisionsInput(body);

    if ('problems' in input) {
      throw ProblemException.invalid(DECISIONS, input.problems);
    }

    const recorded = await this.commandBus.execute<
      RecordRunDecisionsCommand,
      RecordedDecisions
    >(new RecordRunDecisionsCommand(runId, runnerId, input.decisions));

    if (recorded.outcome === 'invalid') {
      throw ProblemException.invalid(DECISIONS, recorded.problems);
    }

    return new RecordedDecisionsResponseDto(recorded.ids);
  }
}

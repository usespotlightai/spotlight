import { SubmitAssistResultCommand } from '@assist/application/commands/submit-assist-result.command';
import type { AssistResultSubmitted } from '@assist/application/dto/assist-result.dto';
import {
  AssistResultAcceptedResponseDto,
  SubmitAssistResultRequestDto,
} from '@assist/presentation/http/dto/assist-result.dto';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
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

const RESULT = 'assist result';

const resultOf = (body: unknown): unknown =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as { readonly result?: unknown }).result
    : undefined;

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@ApiExtraModels(ProblemResponseDto)
@UseFilters(ProblemFilter)
@MachineOnly()
@Controller('runs/:runId/assist-result')
export class RunnerAssistResultController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'submitAssistResult',
    summary:
      'Submit the result of an assist session from inside its run; Spotlight checks it against the shape its kind asks for',
    description:
      'A result that does not fit may be fixed and submitted again. Once a result is accepted, the session takes no other.',
  })
  @ApiBody({ type: SubmitAssistResultRequestDto })
  @ApiOkResponse({ type: AssistResultAcceptedResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'This runner does not lease the run',
  )
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The run is no assist session, or its session accepted a result already or failed',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'A result that does not fit the shape its kind asks for; errors name each problem’s path in the result',
  )
  async submit(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @CurrentMachine() runnerId: string,
  ): Promise<AssistResultAcceptedResponseDto> {
    const submitted = await this.commandBus.execute<
      SubmitAssistResultCommand,
      AssistResultSubmitted
    >(new SubmitAssistResultCommand(runId, runnerId, resultOf(body)));

    switch (submitted.outcome) {
      case 'accepted':
        return new AssistResultAcceptedResponseDto();
      case 'invalid':
        throw ProblemException.invalid(RESULT, submitted.problems);
      case 'not-leased':
        throw ProblemException.notFound(
          'run',
          'This runner does not lease the run.',
        );
      case 'not-an-assist-run':
        throw ProblemException.of({
          slug: 'not-an-assist-run',
          title: 'The run is no assist session',
          status: HttpStatus.CONFLICT,
          detail: 'Only the run of an assist session submits a result.',
        });
      case 'not-accepted':
        throw ProblemException.of({
          slug: 'assist-result-not-accepted',
          title: 'The assist session takes no more results',
          status: HttpStatus.CONFLICT,
          detail:
            'The assist session accepted a result already, or it failed. Stop now.',
        });
    }
  }
}

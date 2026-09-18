import { DraftRunChangeStackCommand } from '@change-review/application/commands/draft-run-change-stack.command';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import type { ChangeStackChecksDto } from '@change-review/application/dto/change-stack-check.dto';
import { ChangeStackChecksQuery } from '@change-review/application/queries/change-stack-checks.query';
import {
  ChangeStackCheckResponseDto,
  ChangeStackCheckStepResponseDto,
  ChangeStackChecksResponseDto,
  RecordChangeStackCheckRequestDto,
} from '@change-review/presentation/http/dto/change-stack-check.dto';
import { DraftChangeStackRequestDto } from '@change-review/presentation/http/dto/draft-change-stack.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'Missing or wrong enrollment token' })
@RunnerOnly()
@Controller()
export class RunnerChangeStackController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('runs/:runId/change-stacks')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'draftChangeStack',
    summary: 'Hand over what a run changed, to be drafted into a change stack',
    description:
      'A station that says it wants changes has its runs drafted into a ' +
      'change stack: the runner hands over the diff of each checkout.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Not a run this runner worked' })
  async draftChangeStack(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: DraftChangeStackRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new DraftRunChangeStackCommand(
        runId,
        runnerId,
        typeof body.diff === 'string' ? body.diff : '',
        typeof body.repository === 'string' ? body.repository : null,
      ),
    );
  }

  @Get('runs/:runId/change-stack-checks')
  @ApiOperation({
    operationId: 'changeStackChecks',
    summary: 'The change stacks this run drafted that wait to be checked',
    description:
      'Each check is the command the agent named, to run on the whole ' +
      'change and then on every layer with the layers before it.',
  })
  @ApiOkResponse({ type: ChangeStackChecksResponseDto })
  @ApiNotFoundResponse({ description: 'Not a run this runner worked' })
  async changeStackChecks(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<ChangeStackChecksResponseDto> {
    const found = await this.queryBus.execute<
      ChangeStackChecksQuery,
      ChangeStackChecksDto | null
    >(new ChangeStackChecksQuery(runId, runnerId));

    if (!found) {
      throw new NotFoundException();
    }

    return new ChangeStackChecksResponseDto(
      found.waiting,
      found.checks.map(
        (check) =>
          new ChangeStackCheckResponseDto(
            check.stackId,
            check.repository,
            check.command,
            check.steps.map(
              (step) =>
                new ChangeStackCheckStepResponseDto(step.id, step.patch),
            ),
          ),
      ),
    );
  }

  @Post('runs/:runId/change-stack-checks/:stackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordChangeStackCheck',
    summary: 'Report whether each layer of a change stack passed its check',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'Not a run this runner worked, or no such stack of it',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The stack was already checked, or names steps it has not',
  })
  async recordChangeStackCheck(
    @Param('runId') runId: string,
    @Param('stackId') stackId: string,
    @CurrentRunner() runnerId: string,
    @Body() body: RecordChangeStackCheckRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordChangeStackCheckCommand(
        runId,
        runnerId,
        stackId,
        typeof body.skipped === 'string' ? body.skipped : null,
        (Array.isArray(body.steps) ? body.steps : []).map((step) => ({
          step: String(step.step),
          passed: step.passed === true,
          output: typeof step.output === 'string' ? step.output : '',
          tookMs: Number(step.tookMs) || 0,
        })),
      ),
    );
  }
}

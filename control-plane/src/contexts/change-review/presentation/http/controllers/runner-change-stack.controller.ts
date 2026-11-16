import { FailPushDiffCommand } from '@change-review/application/commands/fail-push-diff.command';
import { GenerateRunChangeStackCommand } from '@change-review/application/commands/generate-run-change-stack.command';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { RecordPushDiffCommand } from '@change-review/application/commands/record-push-diff.command';
import {
  CHANGE_STACK_CHECK,
  PUSH_DIFF,
  RUN_CHANGE_STACKS,
} from '@change-review/presentation/http/change-stack-routes';
import { RecordChangeStackCheckRequestDto } from '@change-review/presentation/http/dto/change-stack-check.dto';
import { GenerateChangeStackRequestDto } from '@change-review/presentation/http/dto/generate-change-stack.dto';
import {
  FailPushDiffRequestDto,
  RecordPushDiffRequestDto,
} from '@change-review/presentation/http/dto/push-diff.dto';
import {
  pushDiffFailureInput,
  pushDiffInput,
} from '@change-review/presentation/http/mappers/push-diff-report-input';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AcceptsLargeBody } from '@platform/http/decorators/accepts-large-body.decorator';
import { CurrentMachine } from '@platform/http/decorators/current-machine.decorator';
import { MachineOnly } from '@platform/http/decorators/machine-only.decorator';

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@MachineOnly()
@Controller()
export class RunnerChangeStackController {
  constructor(private readonly commandBus: CommandBus) {}

  @AcceptsLargeBody()
  @Post(RUN_CHANGE_STACKS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'generateChangeStack',
    summary:
      'Hand over what a run changed, so that Spotlight generates a change stack from it',
    description:
      'Spotlight generates a change stack for each run of a station that asks for diffs: ' +
      'the runner hands over the diff of each checkout.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Not a run this runner claimed' })
  @ApiConflictResponse({
    description: 'The run has no checkouts, so it changes no repository',
  })
  async generateChangeStack(
    @Param('runId') runId: string,
    @CurrentMachine() runnerId: string,
    @Body() body: GenerateChangeStackRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new GenerateRunChangeStackCommand(
        runId,
        runnerId,
        typeof body.diff === 'string' ? body.diff : '',
        typeof body.repository === 'string' ? body.repository : null,
        typeof body.base === 'string' ? body.base : null,
      ),
    );
  }

  @AcceptsLargeBody()
  @Post(CHANGE_STACK_CHECK)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordChangeStackCheck',
    summary: 'Report whether each layer of a change stack passed its check',
  })
  @ApiQuery({
    name: 'recheck',
    required: false,
    type: Boolean,
    description:
      'true when the check is the recheck of a trial’s change, as its claim said',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'No change stack with a check to record',
  })
  @ApiConflictResponse({
    description:
      'This runner does not have the lease on the check of that stack',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The stack was already checked, or names steps it has not',
  })
  async recordChangeStackCheck(
    @Param('stackId') stackId: string,
    @Query('recheck') recheck: string | undefined,
    @CurrentMachine() runnerId: string,
    @Body() body: RecordChangeStackCheckRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordChangeStackCheckCommand(
        runnerId,
        stackId,
        recheck === 'true',
        body.skipped
          ? {
              // oxlint-disable-next-line typescript/no-unnecessary-type-conversion -- the request body is not validated at runtime
              code: String(body.skipped.code),
              detail:
                typeof body.skipped.detail === 'string'
                  ? body.skipped.detail
                  : null,
            }
          : null,
        (Array.isArray(body.steps) ? body.steps : []).map((step) => ({
          // oxlint-disable-next-line typescript/no-unnecessary-type-conversion -- the request body is not validated at runtime
          step: String(step.step),
          // oxlint-disable-next-line typescript/no-unnecessary-boolean-literal-compare -- the request body is not validated at runtime
          passed: step.passed === true,
          output: typeof step.output === 'string' ? step.output : '',
          // oxlint-disable-next-line typescript/no-unnecessary-type-conversion -- the request body is not validated at runtime
          durationMs: Number(step.durationMs) || 0,
        })),
      ),
    );
  }

  @AcceptsLargeBody()
  @Post(`${PUSH_DIFF}/diff`)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'recordPushDiff',
    summary:
      'Hand over the diff of a push to a pull request, so that Spotlight redrafts its change stack',
  })
  @ApiNoContentResponse({
    description:
      'The diff is recorded. Spotlight records a diff it refuses to stack as failed. A diff it cannot stack for now goes back to wait, or fails once every runner attempt is used. A report on a diff already settled answers the same.',
  })
  @ApiBadRequestResponse({
    description: 'The body has no diff or no base as text',
  })
  @ApiNotFoundResponse({ description: 'No such push diff' })
  @ApiConflictResponse({
    description:
      'The diff still waits and this runner does not hold its lease, or the push diff kept changing while it was recorded',
  })
  async recordPushDiff(
    @Param('diffId') diffId: string,
    @CurrentMachine() runnerId: string,
    @Body() body: RecordPushDiffRequestDto,
  ): Promise<void> {
    const { diff, base } = pushDiffInput(body);

    await this.commandBus.execute(
      new RecordPushDiffCommand(diffId, runnerId, diff, base),
    );
  }

  @Post(`${PUSH_DIFF}/failure`)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'failPushDiff',
    summary: 'Report that the runner could not make the diff of a push',
  })
  @ApiNoContentResponse({
    description:
      'The report is taken: the diff goes back to wait, or fails once every runner attempt is used. A report on a diff already settled answers the same.',
  })
  @ApiBadRequestResponse({ description: 'The body has no reason as text' })
  @ApiNotFoundResponse({ description: 'No such push diff' })
  @ApiConflictResponse({
    description:
      'The diff still waits and this runner does not hold its lease, or the push diff kept changing while it was recorded',
  })
  async failPushDiff(
    @Param('diffId') diffId: string,
    @CurrentMachine() runnerId: string,
    @Body() body: FailPushDiffRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new FailPushDiffCommand(diffId, runnerId, pushDiffFailureInput(body)),
    );
  }
}

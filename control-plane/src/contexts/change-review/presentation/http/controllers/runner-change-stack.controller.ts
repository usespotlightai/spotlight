import { GenerateRunChangeStackCommand } from '@change-review/application/commands/generate-run-change-stack.command';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { RecordChangeStackCheckRequestDto } from '@change-review/presentation/http/dto/change-stack-check.dto';
import { GenerateChangeStackRequestDto } from '@change-review/presentation/http/dto/generate-change-stack.dto';
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
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, no longer valid or wrong runner token',
})
@RunnerOnly()
@Controller()
export class RunnerChangeStackController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('runs/:runId/change-stacks')
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
  @ApiNotFoundResponse({ description: 'Not a run this runner worked' })
  @ApiConflictResponse({
    description: 'The run is a search, which changes no repository',
  })
  async generateChangeStack(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
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

  @Post('runs/:runId/change-stack-checks/:stackId')
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
      'true when the check is the recheck of a replay’s change, as its claim said',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    description: 'Not a run this runner worked, or no such stack of it',
  })
  @ApiConflictResponse({
    description:
      'This runner does not have the lease on the check of that stack',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The stack was already checked, or names steps it has not',
  })
  async recordChangeStackCheck(
    @Param('runId') runId: string,
    @Param('stackId') stackId: string,
    @Query('recheck') recheck: string | undefined,
    @CurrentRunner() runnerId: string,
    @Body() body: RecordChangeStackCheckRequestDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordChangeStackCheckCommand(
        runId,
        runnerId,
        stackId,
        recheck === 'true',
        body.skipped
          ? {
              code: String(body.skipped.code),
              detail:
                typeof body.skipped.detail === 'string'
                  ? body.skipped.detail
                  : null,
            }
          : null,
        (Array.isArray(body.steps) ? body.steps : []).map((step) => ({
          step: String(step.step),
          passed: step.passed === true,
          output: typeof step.output === 'string' ? step.output : '',
          durationMs: Number(step.durationMs) || 0,
        })),
      ),
    );
  }
}

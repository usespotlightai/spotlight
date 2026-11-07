import type { LeasedRunFacts } from '@runs/application/ports/run-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { UseToolCommand } from '@work/application/commands/use-tool.command';
import type { ToolAnswerDto } from '@work/application/dto/tool-answer.dto';
import { ToolActingAsMapper } from '@work/application/mappers/tool-acting-as.mapper';
import type { ToolCallResultDto } from '@work/application/ports/integration-tool-calls.port';
import type {
  HookDecision,
  LifecycleHooksPort,
} from '@work/application/ports/lifecycle-hooks.port';
import type {
  TaskViewDto,
  TaskViewsPort,
} from '@work/application/ports/task-views.port';
import type { ToolUsesPort } from '@work/application/ports/tool-uses.port';
import type { RunWorks } from '@work/application/services/run-works.service';
import { ToolCallFailures } from '@work/application/services/tool-call-failures';
import type { ToolSources } from '@work/application/services/tool-sources.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { RecordedToolUse } from '@work/domain/entities/recorded-tool-use.entity';
import { LeaseLostError } from '@work/domain/exceptions/lease-lost.error';
import { ToolApprovalDismissedError } from '@work/domain/exceptions/tool-approval-dismissed.error';
import { ToolAwaitsApprovalError } from '@work/domain/exceptions/tool-awaits-approval.error';
import { ToolAwaitsConnectionError } from '@work/domain/exceptions/tool-awaits-connection.error';
import { ToolBlockedByPersonError } from '@work/domain/exceptions/tool-blocked-by-person.error';
import { ToolConnectionDeniedError } from '@work/domain/exceptions/tool-connection-denied.error';
import { ToolHookDeniedError } from '@work/domain/exceptions/tool-hook-denied.error';
import { ToolNeedsWorkError } from '@work/domain/exceptions/tool-needs-work.error';
import { UnknownToolError } from '@work/domain/exceptions/unknown-tool.error';
import { StricterRule } from '@work/domain/services/stricter-rule';
import { ToolEnablement } from '@work/domain/services/tool-enablement';
import type { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';

export class UseToolHandler
  implements CommandHandlerPort<UseToolCommand, ToolAnswerDto>
{
  constructor(
    private readonly works: RunWorks,
    private readonly sources: ToolSources,
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly ids: IdGeneratorPort,
    private readonly uses: ToolUsesPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: UseToolCommand): Promise<ToolAnswerDto> {
    try {
      const tool = Tool.of(command.tool);
      const { run, work } = await this.works.leasedBy(
        command.runId,
        command.runnerId,
      );

      ToolEnablement.assertEnabled(tool, {
        actsBeyondItself: run.policy.actsBeyondItself,
        manifest: run.manifest,
      });

      if (!work) {
        throw new ToolNeedsWorkError(tool.value);
      }

      const context = await work.toolContext(tool);
      const resolved = await this.sources.resolve(
        tool,
        run,
        context,
        command.runnerId,
      );

      if (!resolved) {
        throw new UnknownToolError(tool.value);
      }

      if (resolved.missing) {
        const asked = await work.askToConnect(
          resolved.declared,
          resolved.missing,
        );

        if (asked.kind === 'asked') {
          throw new ToolAwaitsConnectionError(
            tool.value,
            resolved.missing.integrationName,
          );
        }

        throw new ToolConnectionDeniedError(tool.value, asked.reason);
      }

      const ruled = StricterRule.of(resolved.declared, resolved.personRule);

      if (ruled.kind === 'blocked') {
        throw new ToolBlockedByPersonError(tool.value, ruled.by);
      }

      const declared =
        ruled.kind === 'needs-approval'
          ? resolved.declared.withApproval(ruled.needed)
          : resolved.declared;
      const { intent, rest } = declared.intentIn(command.input);
      const accepted = declared.accept(rest, (input) =>
        resolved.defaultFor(input),
      );
      const cleared = await work.clearFor(
        declared,
        declared.callWith(accepted),
        intent,
      );

      if (cleared.kind === 'pending') {
        throw new ToolAwaitsApprovalError(tool.value);
      }

      if (cleared.kind === 'dismissed') {
        throw new ToolApprovalDismissedError(tool.value, cleared.reason);
      }

      let inputs = accepted;

      try {
        if (cleared.edited) {
          inputs = declared.accept(cleared.edited.values, (input) =>
            resolved.defaultFor(input),
          );
        }

        const taskView = await this.taskViewOf(run);
        const decision: HookDecision = taskView
          ? await this.hooks.before(taskView, {
              on: 'tool.using',
              tool: tool.value,
              inputs: inputs.values,
            })
          : { kind: 'allowed' };

        if (decision.kind === 'denied') {
          throw new ToolHookDeniedError(tool.value, decision.reason);
        }

        await this.works.stillOn(run, command.runnerId);
      } catch (error) {
        await cleared.returned();
        throw error;
      }

      let result: ToolCallResultDto;

      try {
        result = await resolved.call(inputs);
      } catch (error) {
        await cleared.returned();

        if (error instanceof LeaseLostError) {
          throw error;
        }

        await this.used(
          run,
          tool,
          inputs,
          ToolOutput.answered(error instanceof Error ? error.message : null),
          true,
          resolved.actingAs,
        );
        throw error;
      }

      if (result.outcome === 'failed') {
        await cleared.returned();
        await this.used(
          run,
          tool,
          inputs,
          ToolOutput.answered(result.failure.reason),
          true,
          resolved.actingAs,
        );
        throw ToolCallFailures.errorOf(result.failure);
      }

      const { output } = result;

      await this.used(
        run,
        tool,
        inputs,
        ToolOutput.answered(output),
        false,
        resolved.actingAs,
      );

      return {
        output,
        actingAs: resolved.actingAs
          ? ToolActingAsMapper.toDto(resolved.actingAs)
          : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private taskViewOf(run: LeasedRunFacts): Promise<TaskViewDto | null> {
    const task = WorkRequesters.taskOf(run.requester);

    return task
      ? this.taskViews.of(task.value, run.runId.value)
      : Promise.resolve(null);
  }

  private async used(
    run: LeasedRunFacts,
    tool: Tool,
    inputs: ToolInputs,
    output: ToolOutput,
    failed: boolean,
    actingAs: ToolActingAs | null,
  ): Promise<void> {
    const use = RecordedToolUse.of({
      run: {
        id: run.runId,
        attempt: run.attempt,
        task: WorkRequesters.taskOf(run.requester),
      },
      useId: this.ids.generate(),
      tool,
      inputs,
      output,
      failed,
      actingAs,
      at: this.clock.now(),
    });

    if (use) {
      await this.uses.record(use);
    }
  }
}

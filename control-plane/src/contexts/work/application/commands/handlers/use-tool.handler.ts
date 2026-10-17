import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { UseToolCommand } from '@work/application/commands/use-tool.command';
import type { ToolAnswerDto } from '@work/application/dto/tool-answer.dto';
import { ToolActingAsMapper } from '@work/application/mappers/tool-acting-as.mapper';
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type {
  HookVerdict,
  LifecycleHooksPort,
} from '@work/application/ports/lifecycle-hooks.port';
import type { RunWorks } from '@work/application/services/run-works.service';
import type { ToolSources } from '@work/application/services/tool-sources.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import { ToolApprovalRefusedError } from '@work/domain/exceptions/tool-approval-refused.error';
import { ToolAwaitsApprovalError } from '@work/domain/exceptions/tool-awaits-approval.error';
import { ToolAwaitsConnectionError } from '@work/domain/exceptions/tool-awaits-connection.error';
import { ToolBlockedByPersonError } from '@work/domain/exceptions/tool-blocked-by-person.error';
import { ToolConnectionDeniedError } from '@work/domain/exceptions/tool-connection-denied.error';
import { ToolHookDeniedError } from '@work/domain/exceptions/tool-hook-denied.error';
import { ToolNeedsWorkError } from '@work/domain/exceptions/tool-needs-work.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import { UnknownToolError } from '@work/domain/exceptions/unknown-tool.error';
import { StricterRule } from '@work/domain/services/stricter-rule';
import { Tool } from '@work/domain/value-objects/tool.vo';
import type { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';

export class UseToolHandler
  implements CommandHandlerPort<UseToolCommand, ToolAnswerDto>
{
  constructor(
    private readonly works: RunWorks,
    private readonly sources: ToolSources,
    private readonly hookedTasks: HookedTasksPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly ids: IdGeneratorPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: UseToolCommand): Promise<ToolAnswerDto> {
    try {
      const tool = Tool.of(command.tool);
      const { run, work } = await this.works.leasedBy(
        command.runId,
        command.runnerId,
      );

      if (!run.isEnabled(tool)) {
        throw new ToolNotEnabledError(tool.value);
      }

      if (!work) {
        throw new ToolNeedsWorkError(tool.value);
      }

      const context = await work.toolContext();
      const resolved = await this.sources.resolve(
        tool,
        run,
        context,
        command.runnerId,
      );

      if (!resolved) {
        throw new UnknownToolError(tool.value);
      }

      if (resolved.wants) {
        const asked = await work.askToConnect(
          resolved.declared,
          resolved.wants,
        );

        if (asked.kind === 'asked') {
          throw new ToolAwaitsConnectionError(
            tool.value,
            resolved.wants.integration,
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

      if (cleared.kind === 'asked') {
        throw new ToolAwaitsApprovalError(tool.value);
      }

      if (cleared.kind === 'refused') {
        throw new ToolApprovalRefusedError(tool.value, cleared.reason);
      }

      let inputs = accepted;

      try {
        if (cleared.edited) {
          inputs = declared.accept(cleared.edited.values, (input) =>
            resolved.defaultFor(input),
          );
        }

        const hooked = await this.hookedTaskOf(run);
        const verdict: HookVerdict = hooked
          ? await this.hooks.before(hooked, {
              on: 'tool.using',
              tool: tool.value,
              inputs: inputs.values,
            })
          : { kind: 'allowed' };

        if (verdict.kind === 'denied') {
          throw new ToolHookDeniedError(tool.value, verdict.reason);
        }

        await this.works.stillOn(run.currentAttempt, command.runnerId);
      } catch (error) {
        await cleared.returned();
        throw error;
      }

      let output: unknown;

      try {
        output = await resolved.call(inputs);
      } catch (error) {
        await cleared.returned();

        if (error instanceof RunAttemptOverError) {
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

  private hookedTaskOf(run: Run): Promise<HookedTaskDto | null> {
    return run.firesHooks && run.taskId
      ? this.hookedTasks.of(run.taskId.value, run.id.value)
      : Promise.resolve(null);
  }

  private async used(
    run: Run,
    tool: Tool,
    inputs: ToolInputs,
    output: ToolOutput,
    failed: boolean,
    actingAs: ToolActingAs | null,
  ): Promise<void> {
    if (!run.taskId) {
      return;
    }

    await this.events.dispatch([
      new ToolUsed(
        run.id,
        run.taskId,
        tool,
        inputs,
        output,
        failed,
        this.ids.generate(),
        actingAs,
      ),
    ]);
  }
}

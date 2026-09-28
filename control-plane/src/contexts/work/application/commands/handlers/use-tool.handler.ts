import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { UseToolCommand } from '@work/application/commands/use-tool.command';
import type { ToolAnswerDto } from '@work/application/dto/tool-answer.dto';
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
import { ToolHookRefusedError } from '@work/domain/exceptions/tool-hook-refused.error';
import { ToolNeedsWorkError } from '@work/domain/exceptions/tool-needs-work.error';
import { ToolNotGivenError } from '@work/domain/exceptions/tool-not-given.error';
import { UnknownToolError } from '@work/domain/exceptions/unknown-tool.error';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
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
      const { run, work } = await this.works.heldBy(
        command.runId,
        command.runnerId,
      );

      if (!run.wasGiven(tool)) {
        throw new ToolNotGivenError(tool.value);
      }

      if (!work) {
        throw new ToolNeedsWorkError(tool.value);
      }

      const context = await work.toolContext();
      const reachable = await this.sources.reach(
        tool,
        run,
        context,
        command.runnerId,
      );

      if (!reachable) {
        throw new UnknownToolError(tool.value);
      }

      const inputs = reachable.declared.accept(command.input, (input) =>
        reachable.defaultFor(input),
      );
      const cleared = await work.clearFor(
        reachable.declared,
        ToolCall.of(tool, inputs),
      );

      if (cleared.kind === 'asked') {
        throw new ToolAwaitsApprovalError(tool.value);
      }

      if (cleared.kind === 'refused') {
        throw new ToolApprovalRefusedError(tool.value, cleared.reason);
      }

      try {
        const hooked = await this.hookedTaskOf(run);
        const verdict: HookVerdict = hooked
          ? await this.hooks.before(hooked, {
              on: 'tool.using',
              tool: tool.value,
              inputs: inputs.values,
            })
          : { kind: 'allowed' };

        if (verdict.kind === 'refused') {
          throw new ToolHookRefusedError(tool.value, verdict.reason);
        }

        await this.works.stillOn(run.currentAttempt, command.runnerId);
      } catch (error) {
        await cleared.returned();
        throw error;
      }

      let output: unknown;

      try {
        output = await reachable.call(inputs);
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
        );
        throw error;
      }

      await this.used(run, tool, inputs, ToolOutput.answered(output), false);

      return { output };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private hookedTaskOf(run: Run): Promise<HookedTaskDto | null> {
    return run.taskId
      ? this.hookedTasks.of(run.taskId.value, run.id.value)
      : Promise.resolve(null);
  }

  private async used(
    run: Run,
    tool: Tool,
    inputs: ToolInputs,
    output: ToolOutput,
    failed: boolean,
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
      ),
    ]);
  }
}

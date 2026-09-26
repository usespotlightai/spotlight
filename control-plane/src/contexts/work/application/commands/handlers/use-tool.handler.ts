import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
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
import { ToolApprovalRefusedError } from '@work/domain/exceptions/tool-approval-refused.error';
import { ToolAwaitsApprovalError } from '@work/domain/exceptions/tool-awaits-approval.error';
import { ToolHookRefusedError } from '@work/domain/exceptions/tool-hook-refused.error';
import { ToolNeedsWorkError } from '@work/domain/exceptions/tool-needs-work.error';
import { ToolNotGivenError } from '@work/domain/exceptions/tool-not-given.error';
import { UnknownToolError } from '@work/domain/exceptions/unknown-tool.error';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

type Used =
  | { readonly failed: false; readonly output: unknown }
  | { readonly failed: true; readonly output: string | null };

export class UseToolHandler
  implements CommandHandlerPort<UseToolCommand, ToolAnswerDto>
{
  constructor(
    private readonly works: RunWorks,
    private readonly sources: ToolSources,
    private readonly hookedTasks: HookedTasksPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly ids: IdGeneratorPort,
    private readonly logger: LoggerPort,
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
      const reachable = await this.sources.reach(tool, run, context);

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

      let hooked: HookedTaskDto | null;

      try {
        hooked = await this.hookedTaskOf(run);
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
      } catch (error) {
        await cleared.returned();
        throw error;
      }

      try {
        const output = await reachable.call(inputs);
        await this.used(hooked, tool, inputs, { failed: false, output });

        return { output };
      } catch (error) {
        await cleared.returned();
        await this.used(hooked, tool, inputs, {
          failed: true,
          output: error instanceof Error ? error.message : null,
        });
        throw error;
      }
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
    hooked: HookedTaskDto | null,
    tool: Tool,
    inputs: ToolInputs,
    used: Used,
  ): Promise<void> {
    if (!hooked) {
      return;
    }

    try {
      await this.hooks.after(
        hooked,
        {
          on: 'tool.used',
          tool: tool.value,
          inputs: inputs.values,
          output: used.output,
          failed: used.failed,
        },
        this.ids.generate(),
      );
    } catch (error) {
      this.logger.warn(
        {
          taskId: hooked.taskId,
          runId: hooked.runId,
          tool: tool.value,
          error: error instanceof Error ? error.message : String(error),
        },
        'The hooks after a tool was used could not be fired',
      );
    }
  }
}

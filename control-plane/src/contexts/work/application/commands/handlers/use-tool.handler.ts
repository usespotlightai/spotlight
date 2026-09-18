import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { UseToolCommand } from '@work/application/commands/use-tool.command';
import type { ToolAnswerDto } from '@work/application/dto/tool-answer.dto';
import type { IntegrationToolsPort } from '@work/application/ports/integration-tools.port';
import type { BuiltInTools } from '@work/application/services/built-in-tools.service';
import type { RunWorks } from '@work/application/services/run-works.service';
import { ToolApprovalRefusedError } from '@work/domain/exceptions/tool-approval-refused.error';
import { ToolAwaitsApprovalError } from '@work/domain/exceptions/tool-awaits-approval.error';
import { ToolNeedsWorkError } from '@work/domain/exceptions/tool-needs-work.error';
import { ToolNotGivenError } from '@work/domain/exceptions/tool-not-given.error';
import { UnknownToolError } from '@work/domain/exceptions/unknown-tool.error';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';

export class UseToolHandler
  implements CommandHandlerPort<UseToolCommand, ToolAnswerDto>
{
  constructor(
    private readonly works: RunWorks,
    private readonly builtIns: BuiltInTools,
    private readonly integrationTools: IntegrationToolsPort,
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
      const reachable = tool.integration
        ? await this.integrationTools.reach(tool, context)
        : this.builtIns.reach(tool, context);

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
        return { output: await reachable.call(inputs) };
      } catch (error) {
        await cleared.returned();
        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

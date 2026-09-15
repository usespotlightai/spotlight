import type { UseToolCommand } from '@application/commands/use-tool.command';
import { RunSpecContract } from '@application/contracts/run-spec.contract';
import type { ToolAnswerDto } from '@application/dto/tool-answer.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IntegrationToolsPort } from '@application/ports/integration-tools.port';
import type { BuiltInTools } from '@application/services/built-in-tools.service';
import type { RunWorks } from '@application/services/run-works.service';
import { ToolNeedsWorkError } from '@domain/exceptions/tool-needs-work.error';
import { ToolNotGivenError } from '@domain/exceptions/tool-not-given.error';
import { UnknownToolError } from '@domain/exceptions/unknown-tool.error';
import { Tool } from '@domain/value-objects/tool.vo';

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

      if (!RunSpecContract.toolsGiven(run.spec.value).includes(tool.value)) {
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

      return { output: await reachable.call(inputs) };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

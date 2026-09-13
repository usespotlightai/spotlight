import type { UseToolCommand } from '@application/commands/use-tool.command';
import { RunSpecContract } from '@application/contracts/run-spec.contract';
import type { ToolAnswerDto } from '@application/dto/tool-answer.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IntegrationToolsPort } from '@application/ports/integration-tools.port';
import type { BuiltInTools } from '@application/services/built-in-tools.service';
import type { RunAtHand } from '@application/services/run-at-hand.service';
import { ToolNeedsTaskError } from '@domain/exceptions/tool-needs-task.error';
import { ToolNotGivenError } from '@domain/exceptions/tool-not-given.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { UnknownToolError } from '@domain/exceptions/unknown-tool.error';
import type { LineRepository } from '@domain/repositories/line.repository';
import { Tool } from '@domain/value-objects/tool.vo';

export class UseToolHandler
  implements CommandHandlerPort<UseToolCommand, ToolAnswerDto>
{
  constructor(
    private readonly held: RunAtHand,
    private readonly lines: LineRepository,
    private readonly builtIns: BuiltInTools,
    private readonly integrationTools: IntegrationToolsPort,
  ) {}

  async execute(command: UseToolCommand): Promise<ToolAnswerDto> {
    try {
      const tool = Tool.of(command.tool);
      const { run, task } = await this.held.heldBy(
        command.runId,
        command.runnerId,
      );

      if (!RunSpecContract.toolsGiven(run.spec.value).includes(tool.value)) {
        throw new ToolNotGivenError(tool.value);
      }

      if (!task) {
        throw new ToolNeedsTaskError(tool.value);
      }

      const stationId = run.stationId ?? task.stationId;
      const line = await this.lines.holding(stationId);

      if (!line) {
        throw new UnknownStationError(stationId.value);
      }

      const context = { run, task, line };
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

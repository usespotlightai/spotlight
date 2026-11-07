import type { RecordToolOutputCommand } from '@integrations/application/commands/record-tool-output.command';
import type { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class RecordToolOutputHandler
  implements CommandHandlerPort<RecordToolOutputCommand, void>
{
  constructor(private readonly inferring: InferOutputSchemas) {}

  async execute(command: RecordToolOutputCommand): Promise<void> {
    await this.inferring.infer(command.teamId, command.tool, command.answer);
  }
}

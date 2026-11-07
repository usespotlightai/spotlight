import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { CarryGitCallCommand } from '@work/application/commands/carry-git-call.command';
import type { GitAnswerDto } from '@work/application/dto/git-call.dto';
import type { CarryGitCall } from '@work/application/services/carry-git-call.service';

export class CarryGitCallHandler
  implements CommandHandlerPort<CarryGitCallCommand, GitAnswerDto | null>
{
  constructor(private readonly carrying: CarryGitCall) {}

  execute(command: CarryGitCallCommand): Promise<GitAnswerDto | null> {
    return this.carrying.carry(
      command.runId,
      command.runnerId,
      command.repo,
      command.service,
      command.call,
    );
  }
}

import type { HarnessToolNamesPort } from '@runs/application/ports/harness-tool-names.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import type {
  PermissionAnswer,
  PermissionAnswerDto,
} from '@work/application/dto/permission-answer.dto';
import type { PermissionCleared } from '@work/application/services/run-work';
import type { RunWorks } from '@work/application/services/run-works.service';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';

const ANSWERS: Readonly<Record<PermissionCleared, PermissionAnswer>> = {
  approved: 'allow',
  dismissed: 'reject',
  pending: 'pending',
};

export class AskPermissionHandler implements CommandHandlerPort<
  AskPermissionCommand,
  PermissionAnswerDto
> {
  constructor(
    private readonly works: RunWorks,
    private readonly toolNames: HarnessToolNamesPort,
  ) {}

  async execute(command: AskPermissionCommand): Promise<PermissionAnswerDto> {
    try {
      const { run, work } = await this.works.leasedBy(
        command.runId,
        command.runnerId,
      );

      if (!work) {
        return { decision: 'reject' };
      }

      const cleared = await work.clearPermission(
        HarnessPermission.asked({
          harness: run.harness,
          kind: command.asked.kind,
          title: command.asked.title,
          input: command.asked.input,
          tool: this.calledTool(command.asked.title, command.asked.kind),
        }),
        command.asked.sessionId
          ? HarnessSession.of(command.asked.sessionId)
          : null,
      );

      return { decision: ANSWERS[cleared] };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private calledTool(title: string, kind: string): CalledTool | null {
    const named = this.toolNames.toolFor(title, kind);

    return named ? CalledTool.of(named) : null;
  }
}

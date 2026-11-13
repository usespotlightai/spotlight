import type { EditorLeasesPort } from '@runners/application/ports/editor-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ConnectEditorCommand } from '@work/application/commands/connect-editor.command';
import type { EditorConnectionDto } from '@work/application/dto/editor-connection.dto';
import type { EditorTargets } from '@work/application/services/editor-targets.service';

export class ConnectEditorHandler implements CommandHandlerPort<
  ConnectEditorCommand,
  EditorConnectionDto | null
> {
  constructor(
    private readonly targets: EditorTargets,
    private readonly leases: EditorLeasesPort,
  ) {}

  async execute(
    command: ConnectEditorCommand,
  ): Promise<EditorConnectionDto | null> {
    try {
      const found = await this.targets.workingCopyOf(
        UserId.of(command.viewerId),
        command.target,
        command.workspaceSlug,
      );

      if (!found) {
        return null;
      }

      const lease = await this.leases.hold(found.workspaceId.value, found.key);

      return { sandboxId: lease.sandboxId, holder: lease.holder };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

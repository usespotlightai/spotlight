import type { ConnectEditorCommand } from '@runners/application/commands/sandbox-editor.commands';
import type { EditorConnectionDto } from '@runners/application/dto/sandbox-editor.dto';
import type { EditorAccessPort } from '@runners/application/ports/editor-access.port';
import type { EditorSandboxesPort } from '@runners/application/ports/editor-sandboxes.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

const ATTEMPTS = 3;

export class ConnectEditorHandler
  implements
    CommandHandlerPort<ConnectEditorCommand, EditorConnectionDto | null>
{
  constructor(
    private readonly access: EditorAccessPort,
    private readonly sandboxes: EditorSandboxesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: ConnectEditorCommand,
  ): Promise<EditorConnectionDto | null> {
    try {
      const edited = await this.access.editorAccessFor(
        command.viewerId,
        command.target,
        command.workspaceSlug,
      );

      if (!edited) {
        return null;
      }

      const holder = this.ids.generate();

      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const at = this.clock.now();
        const opened = await this.sandboxes.open(
          edited.workspaceId,
          edited.key,
          at,
        );

        if (await this.sandboxes.holdForEditor(opened.id, holder, at)) {
          return { sandboxId: opened.id, holder };
        }
      }

      throw new Error(
        `The sandbox of ${edited.key} drained each time an editor tried to hold it`,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

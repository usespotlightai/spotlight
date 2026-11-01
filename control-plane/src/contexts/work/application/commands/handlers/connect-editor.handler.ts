import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  EditorLease,
  EditorLeasesPort,
} from '@runners/application/ports/editor-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ConnectEditorCommand } from '@work/application/commands/connect-editor.command';
import type { TaskWorkspacesPort } from '@work/application/ports/task-workspaces.port';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';

interface Found {
  readonly workspaceId: WorkspaceId;
  readonly key: ResumeKey;
}

export class ConnectEditorHandler
  implements CommandHandlerPort<ConnectEditorCommand, EditorLease | null>
{
  constructor(
    private readonly tasks: TaskWorkspacesPort,
    private readonly chats: ChatRepository,
    private readonly access: WorkspaceAccessPort,
    private readonly leases: EditorLeasesPort,
  ) {}

  async execute(command: ConnectEditorCommand): Promise<EditorLease | null> {
    try {
      const viewer = UserId.of(command.viewerId);
      const found =
        command.target.kind === 'task'
          ? await this.ofTask(command.target.id)
          : await this.ofChat(viewer, command.target.id);

      if (!found || !(await this.access.mayView(viewer, found.workspaceId))) {
        return null;
      }

      if (command.workspaceSlug !== null) {
        const membership = await this.access.inWorkspace(
          command.workspaceSlug,
          viewer,
        );

        if (!membership?.workspaceId.equals(found.workspaceId)) {
          return null;
        }
      }

      return await this.leases.hold(found.workspaceId.value, found.key.value);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async ofTask(taskId: string): Promise<Found | null> {
    const workspaceId = await this.tasks.workspaceOf(TaskId.of(taskId));

    return workspaceId ? { workspaceId, key: ResumeKey.forTask(taskId) } : null;
  }

  private async ofChat(viewer: UserId, chatId: string): Promise<Found | null> {
    const chat = await this.chats.find(ChatId.of(chatId));

    return chat?.isStartedBy(viewer)
      ? { workspaceId: chat.workspaceId, key: ResumeKey.forChat(chatId) }
      : null;
  }
}

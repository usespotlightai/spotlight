import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  EditedWorkspace,
  EditorAccessPort,
  EditorTarget,
} from '@runners/application/ports/editor-access.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskWorkspacesPort } from '@work/application/ports/task-workspaces.port';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';

interface Found {
  readonly workspaceId: WorkspaceId;
  readonly key: ResumeKey;
}

export class EditorAccess implements EditorAccessPort {
  constructor(
    private readonly tasks: TaskWorkspacesPort,
    private readonly chats: ChatRepository,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async editorAccessFor(
    personId: string,
    target: EditorTarget,
    workspaceSlug: string | null,
  ): Promise<EditedWorkspace | null> {
    const viewer = UserId.of(personId);
    const found =
      target.kind === 'task'
        ? await this.ofTask(target.id)
        : await this.ofChat(viewer, target.id);

    if (!found || !(await this.access.mayView(viewer, found.workspaceId))) {
      return null;
    }

    if (workspaceSlug !== null) {
      const membership = await this.access.inWorkspace(workspaceSlug, viewer);

      if (!membership?.workspaceId.equals(found.workspaceId)) {
        return null;
      }
    }

    return { workspaceId: found.workspaceId.value, key: found.key.value };
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

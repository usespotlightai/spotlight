import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { EditorTarget } from '@work/application/dto/editor-connection.dto';
import type { TaskWorkspacesPort } from '@work/application/ports/task-workspaces.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export interface EditorWorkingCopy {
  readonly workspaceId: WorkspaceId;
  readonly key: string;
}

export class EditorTargets {
  constructor(
    private readonly tasks: TaskWorkspacesPort,
    private readonly chats: ChatRepository,
    private readonly access: WorkAccess,
  ) {}

  async workingCopyOf(
    viewer: UserId,
    target: EditorTarget,
    workspaceSlug: string | null,
  ): Promise<EditorWorkingCopy | null> {
    const found =
      target.kind === 'task'
        ? await this.ofTask(viewer, target.id)
        : await this.ofChat(viewer, target.id);

    if (
      !found ||
      !(await this.access.seesWorkspace(found.workspaceId, viewer))
    ) {
      return null;
    }

    if (workspaceSlug !== null) {
      const workspaceId = await this.access.memberWorkspaceAt(
        workspaceSlug,
        viewer,
      );

      if (!workspaceId?.equals(found.workspaceId)) {
        return null;
      }
    }

    return found;
  }

  private async ofTask(
    viewer: UserId,
    taskId: string,
  ): Promise<EditorWorkingCopy | null> {
    const id = TaskId.of(taskId);
    const [workspaceId, teamId] = await Promise.all([
      this.tasks.workspaceOf(id),
      this.tasks.teamOf(id),
    ]);

    if (!workspaceId || !teamId) {
      return null;
    }

    (await this.access.standingOn(teamId, viewer)).assertActsOnTasks(
      () => new UnknownTaskError(taskId),
    );

    return { workspaceId, key: WorkRequesters.taskWorkingCopyKey(id) };
  }

  private async ofChat(
    viewer: UserId,
    chatId: string,
  ): Promise<EditorWorkingCopy | null> {
    const chat = await this.chats.find(ChatId.of(chatId));

    return chat && (await this.access.opensChat(chat, viewer))
      ? {
          workspaceId: chat.workspaceId,
          key: WorkRequesters.chatWorkingCopyKey(ChatId.of(chatId)),
        }
      : null;
  }
}

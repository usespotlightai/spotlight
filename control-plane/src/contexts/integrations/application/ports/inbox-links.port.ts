import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INBOX_LINKS = Symbol('INBOX_LINKS');

export interface InboxLinksPort {
  conversation(
    workspaceId: WorkspaceId,
    conversationId: string,
  ): Promise<string | null>;

  chat(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    chatId: string,
  ): Promise<string | null>;

  task(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    taskId: TaskId,
  ): Promise<string | null>;
}

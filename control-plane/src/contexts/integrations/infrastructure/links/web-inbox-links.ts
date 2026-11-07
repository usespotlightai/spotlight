import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskLinksPort } from '@work/application/ports/task-links.port';

export class WebInboxLinks implements InboxLinksPort {
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly taskLinks: TaskLinksPort,
  ) {}

  async conversation(
    workspaceId: WorkspaceId,
    conversationId: string,
  ): Promise<string | null> {
    const slug = await this.workspaces.slugOf(workspaceId);

    return slug ? this.taskLinks.conversationPage(slug, conversationId) : null;
  }

  async chat(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    chatId: string,
  ): Promise<string | null> {
    const slug = await this.workspaces.slugOf(workspaceId);

    return slug ? this.taskLinks.chatPage(slug, teamId.value, chatId) : null;
  }

  async task(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    taskId: TaskId,
  ): Promise<string | null> {
    const slug = await this.workspaces.slugOf(workspaceId);

    return slug
      ? this.taskLinks.taskPage(slug, teamId.value, taskId.value)
      : null;
  }
}

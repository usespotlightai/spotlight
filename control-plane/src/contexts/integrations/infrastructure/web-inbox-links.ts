import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';

export class WebInboxLinks implements InboxLinksPort {
  private readonly base: string;

  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    base: string,
  ) {
    this.base = base.replace(/\/+$/, '');
  }

  async conversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<string | null> {
    const slug = await this.workspaces.slugOf(workspaceId);

    return slug ? `${this.base}/w/${slug}/inbox/${conversationId}` : null;
  }

  async chat(
    workspaceId: string,
    teamId: string,
    chatId: string,
  ): Promise<string | null> {
    return this.inTeam(workspaceId, teamId, `agent/${chatId}`);
  }

  async task(
    workspaceId: string,
    teamId: string,
    taskId: string,
  ): Promise<string | null> {
    return this.inTeam(workspaceId, teamId, `tasks/${taskId}`);
  }

  private async inTeam(
    workspaceId: string,
    teamId: string,
    path: string,
  ): Promise<string | null> {
    const slug = await this.workspaces.slugOf(workspaceId);

    return slug ? `${this.base}/w/${slug}/team/${teamId}/${path}` : null;
  }
}

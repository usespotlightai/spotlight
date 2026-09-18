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
}

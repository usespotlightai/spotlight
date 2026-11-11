import type { InboxLinksPort } from '@notifications/application/ports/inbox-links.port';

export class WebInboxLinks implements InboxLinksPort {
  pathTo(
    workspaceSlug: string,
    itemKind: 'task' | 'notice',
    itemId: string,
  ): string {
    const inbox = `/w/${encodeURIComponent(workspaceSlug)}/inbox`;
    const id = encodeURIComponent(itemId);

    return itemKind === 'notice' ? `${inbox}/notices/${id}` : `${inbox}/${id}`;
  }
}

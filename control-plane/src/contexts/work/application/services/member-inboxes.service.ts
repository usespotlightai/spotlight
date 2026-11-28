import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  InboxEntrySummary,
  InboxReaderPort,
} from '@work/application/ports/inbox-reader.port';
import type {
  MemberInbox,
  MemberInboxesPort,
  MemberInboxItem,
} from '@work/application/ports/member-inboxes.port';
import type { WorkAccess } from '@work/application/services/work-access.service';

const INBOXES_AT_ONCE = 4;

// A task is one inbox item, but each thing on it arrives on its own: one is
// announced per part, under the id that part had before items were grouped.
const itemsOf = (entry: InboxEntrySummary): MemberInboxItem[] => {
  switch (entry.kind) {
    case 'task':
      return entry.parts.map((part) => ({
        kind: 'task',
        id: part.id,
        teamId: entry.teamId,
        title: entry.title,
        summary:
          part.id === entry.conversationId
            ? (entry.lastNote?.body ?? entry.description)
            : entry.description,
        unread: part.unread,
        askedAt: part.interactedAt,
      }));
    case 'notice':
      return [
        {
          kind: 'notice',
          id: entry.id,
          teamId: entry.teamId,
          title: entry.headline,
          summary: entry.points[0] ?? null,
          unread: entry.unread,
          askedAt: entry.askedAt,
        },
      ];
    case 'chat':
    case 'run':
      return [];
  }
};

export class MemberInboxes implements MemberInboxesPort {
  constructor(
    private readonly inbox: InboxReaderPort,
    private readonly access: WorkAccess,
  ) {}

  async of(workspaceId: string): Promise<readonly MemberInbox[]> {
    const scopes = await this.access.inboxesIn(WorkspaceId.of(workspaceId));
    const inboxes: MemberInbox[] = [];

    for (let at = 0; at < scopes.length; at += INBOXES_AT_ONCE) {
      const batch = scopes.slice(at, at + INBOXES_AT_ONCE);

      inboxes.push(
        ...(await Promise.all(
          batch.map(async (scope) => ({
            personId: scope.viewer.value,
            teamsSeen: [...scope.teamsSeen],
            isAdmin: scope.isAdmin,
            items: (await this.inbox.open(scope)).flatMap(itemsOf),
          })),
        )),
      );
    }

    return inboxes;
  }
}

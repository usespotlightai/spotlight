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

const itemOf = (entry: InboxEntrySummary): MemberInboxItem | null => {
  switch (entry.kind) {
    case 'task':
      return {
        kind: 'task',
        id: entry.id,
        teamId: entry.teamId,
        title: entry.title,
        summary: entry.lastNote?.body ?? entry.description,
        unread: entry.unread,
        askedAt: entry.askedAt,
      };
    case 'notice':
      return {
        kind: 'notice',
        id: entry.id,
        teamId: entry.teamId,
        title: entry.headline,
        summary: entry.points[0] ?? null,
        unread: entry.unread,
        askedAt: entry.askedAt,
      };
    case 'chat':
    case 'run':
      return null;
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
            items: (await this.inbox.open(scope)).flatMap(
              (entry) => itemOf(entry) ?? [],
            ),
          })),
        )),
      );
    }

    return inboxes;
  }
}

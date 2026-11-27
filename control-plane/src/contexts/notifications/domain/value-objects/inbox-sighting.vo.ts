import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type InboxArrivalKind = 'task' | 'notice';

export interface InboxSighting {
  readonly person: UserId;
  // Null for a notice about the whole workspace.
  readonly teamId: TeamId | null;
  readonly itemId: string;
  readonly kind: InboxArrivalKind;
  readonly title: string;
  readonly summary: string | null;
  readonly unread: boolean;
  readonly askedAt: Date;
}

export interface InboxAnnouncement {
  readonly person: string;
  readonly itemId: string;
  readonly askedAt: Date;
}

export interface InboxRecount {
  readonly requestedAt: Date;
  readonly attempts: number;
  readonly dueAt: Date | null;
  readonly waitingSince: Date | null;
}

export interface ArrivalLedgerer {
  readonly person: UserId;
  readonly teams: readonly TeamId[];
  // An owner or admin, who watches the notices about the whole workspace.
  readonly seesWorkspace: boolean;
}

// The whole workspace, watched as if it were one more team.
const WORKSPACE_WIDE = '*';

export const watcherKey = (person: string, teamId: string | null): string =>
  `${person}/${teamId ?? WORKSPACE_WIDE}`;

export const watcherKeysOf = (ledgerer: ArrivalLedgerer): string[] => [
  ...ledgerer.teams.map((team) =>
    watcherKey(ledgerer.person.value, team.value),
  ),
  ...(ledgerer.seesWorkspace ? [watcherKey(ledgerer.person.value, null)] : []),
];

export const announcementKey = (person: string, itemId: string): string =>
  `${person}/${itemId}`;

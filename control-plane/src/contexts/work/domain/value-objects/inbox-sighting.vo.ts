import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type InboxArrivalKind = 'task' | 'notice';

export interface InboxSighting {
  readonly person: UserId;
  readonly teamId: TeamId;
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
}

export interface InboxWatcher {
  readonly person: UserId;
  readonly teams: readonly TeamId[];
}

export const watcherKey = (person: string, teamId: string): string =>
  `${person}/${teamId}`;

export const announcementKey = (person: string, itemId: string): string =>
  `${person}/${itemId}`;

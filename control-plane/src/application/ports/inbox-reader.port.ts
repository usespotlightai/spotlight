import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface InboxAuthor {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface InboxNote {
  readonly position: number;
  readonly kind: 'asked' | 'passed' | 'answered' | 'said' | 'closed';
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly runId: string | null;
  readonly body: string;
  readonly at: Date;
  readonly author: InboxAuthor | null;
  readonly readAt: Date | null;
}

/** One station, named the way every other reader names one. */
export interface InboxStation {
  readonly name: string;
  readonly color: string;
  readonly position: number;
}

export interface InboxItemSummary {
  // A task can need someone more than once, so the note names it too.
  readonly id: string;
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly description: string | null;
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly stationCount: number;
  readonly raisedAt: InboxStation;
  readonly standsAt: InboxStation;
  readonly createdAt: Date;
  readonly askedAt: Date;
  readonly resolved: boolean;
  readonly working: boolean;
  readonly unread: boolean;
  // What the station that opened it was given. A conversation begins with the
  // prompt its own station received, not with the one the task started on.
  readonly briefing: string | null;
  readonly notes: readonly InboxNote[];
}

export const INBOX_READER = Symbol('INBOX_READER');

export interface InboxReaderPort {
  /** Theirs alone, newest first, answered ones included. */
  listForWorkspaceMember(
    slug: WorkspaceSlug,
    userId: UserId,
  ): Promise<InboxItemSummary[] | null>;
}

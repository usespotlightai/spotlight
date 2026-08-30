import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface InboxAuthor {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface InboxNote {
  readonly position: number;
  // What it did to the task: opened a stretch a person owns, closed one, or
  // answered within it.
  readonly kind: 'asked' | 'passed' | 'answered';
  // The station that said it, which is not always where the task stands now.
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly runId: string | null;
  readonly body: string;
  readonly at: Date;
  readonly author: InboxAuthor | null;
}

export interface InboxRaisedAt {
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
}

export interface InboxItemSummary {
  // One stretch a person owns, named by the task and the note that opened it:
  // a task can need someone more than once.
  readonly id: string;
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly description: string | null;
  readonly station: string;
  readonly stationColor: string;
  readonly stationPosition: number;
  readonly stationCount: number;
  readonly raisedAt: InboxRaisedAt;
  readonly createdAt: Date;
  readonly askedAt: Date;
  readonly resolved: boolean;
  readonly working: boolean;
  // Oldest first: the story, ending with what it is waiting on.
  readonly notes: readonly InboxNote[];
}

export const INBOX_READER = Symbol('INBOX_READER');

export interface InboxReaderPort {
  /** Newest first, including what they have already answered. */
  listForWorkspaceMember(
    slug: WorkspaceSlug,
    userId: UserId,
  ): Promise<InboxItemSummary[] | null>;
}

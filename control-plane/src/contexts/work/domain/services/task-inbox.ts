import { firstOf } from '@shared-kernel/domain/item-at';
import {
  ConversationAudience,
  type ConversationStanding,
} from '@work/domain/services/conversation-audience';
import type { InboxRequestForm } from '@work/domain/value-objects/inbox-request-form';

// Everything on one task that waits on a person is one inbox item: the
// station's question or failed run, and each inbox request raised about the
// task (judge questions, proposed memories, station alerts).
export const INBOX_PART_KINDS = [
  'question',
  'failure',
  'judge-question',
  'memories',
  'alert',
] as const;

export type InboxPartKind = (typeof INBOX_PART_KINDS)[number];

export interface InboxPart {
  readonly kind: InboxPartKind;
  // How many questions it puts to people: one, or for a judge disagreement
  // each disputed claim still unanswered. Counts are in questions, so the
  // item's "N new", its preview and the badge all count what people see.
  readonly asks: number;
  readonly open: boolean;
  // Open and waiting on a person now: a conversation whose run works on the
  // answer is open but waits on the run.
  readonly waits: boolean;
  readonly unread: boolean;
  readonly unreadSince: Date | null;
  readonly arrivedAt: Date;
  readonly interactedAt: Date;
  readonly resolvedAt: Date | null;
  readonly resolvable: boolean;
  readonly reopenable: boolean;
}

export interface InboxPartPreview {
  readonly kind: InboxPartKind;
  readonly count: number;
}

export interface TaskInboxStanding {
  readonly unreadCount: number;
  readonly resolved: boolean;
  readonly listedAsOpen: boolean;
  readonly latest: InboxPartPreview | null;
  readonly quiet: boolean;
  readonly arrivedAt: Date;
  readonly interactedAt: Date;
  readonly resolvedAt: Date | null;
  readonly resolvable: boolean;
  readonly reopenable: boolean;
}

const KIND_OF_REQUEST: Readonly<Record<InboxRequestForm, InboxPartKind>> = {
  'judge-disagreement': 'judge-question',
  memories: 'memories',
  alert: 'alert',
};

const CONVERSATION_KINDS: ReadonlySet<InboxPartKind> = new Set([
  'question',
  'failure',
]);

const BLOCKS_THE_LINE = CONVERSATION_KINDS;

const later = (one: Date, other: Date): Date => (other > one ? other : one);

const newestFirst = <T extends InboxPart>(parts: readonly T[]): T[] =>
  [...parts].sort((one, other) => +other.arrivedAt - +one.arrivedAt);

const latestResolution = (parts: readonly InboxPart[]): Date | null =>
  parts.reduce<Date | null>(
    (latest, part) =>
      part.resolvedAt && (!latest || part.resolvedAt > latest)
        ? part.resolvedAt
        : latest,
    null,
  );

const questionsIn = (parts: readonly InboxPart[]): number =>
  parts.reduce((sum, part) => sum + part.asks, 0);

const previewOf = (unread: readonly InboxPart[]): InboxPartPreview | null => {
  const newest =
    newestFirst(unread).find((part) => TaskInbox.blocksTheLine(part.kind)) ??
    firstOf(newestFirst(unread));

  return newest
    ? {
        kind: newest.kind,
        count: questionsIn(unread.filter((part) => part.kind === newest.kind)),
      }
    : null;
};

export const TaskInbox = {
  kindOfRequest(form: InboxRequestForm): InboxPartKind {
    return KIND_OF_REQUEST[form];
  },

  kindOfConversation(failed: boolean): InboxPartKind {
    return failed ? 'failure' : 'question';
  },

  blocksTheLine(kind: InboxPartKind): boolean {
    return BLOCKS_THE_LINE.has(kind);
  },

  isConversation(kind: InboxPartKind): boolean {
    return CONVERSATION_KINDS.has(kind);
  },

  // A task's conversation belongs to its item while it is open on a task
  // still on the line, and afterwards for its assignee, as history.
  holdsConversation(
    conversation: { readonly open: boolean },
    task: { readonly finished: boolean },
    standing: ConversationStanding,
  ): boolean {
    return conversation.open
      ? !task.finished
      : ConversationAudience.listsResolved(standing);
  },

  // The item opens on the task's open conversation, else its newest one;
  // a task with no conversation opens on its newest request.
  anchorOf<T extends InboxPart>(parts: readonly T[]): T | null {
    const conversations = newestFirst(
      parts.filter((part) => TaskInbox.isConversation(part.kind)),
    );

    return (
      conversations.find((part) => part.open) ??
      firstOf(conversations) ??
      firstOf(newestFirst(parts)) ??
      null
    );
  },

  standingOf(parts: readonly InboxPart[]): TaskInboxStanding | null {
    const first = firstOf(parts);

    if (first === undefined) {
      return null;
    }

    const unread = parts.filter((part) => part.unread);
    const resolved = parts.every((part) => !part.open);
    // The row previews what is new; once all is read, what still waits.
    const previewed =
      unread.length > 0 ? unread : parts.filter((part) => part.waits);

    return {
      unreadCount: questionsIn(unread),
      resolved,
      listedAsOpen: !resolved || unread.length > 0,
      latest: previewOf(previewed),
      quiet:
        previewed.length > 0 &&
        previewed.every((part) => part.kind === 'judge-question'),
      arrivedAt: parts.reduce(
        (latest, part) => later(latest, part.arrivedAt),
        first.arrivedAt,
      ),
      interactedAt: parts.reduce(
        (latest, part) => later(latest, part.interactedAt),
        first.interactedAt,
      ),
      resolvedAt: resolved ? latestResolution(parts) : null,
      resolvable: parts.some((part) => part.open && part.resolvable),
      reopenable: TaskInbox.toReopen(parts).length > 0,
    };
  },

  // Where the item opens: the part with the oldest note not seen yet.
  firstUnread<T extends InboxPart>(parts: readonly T[]): T | null {
    return (
      firstOf(
        parts
          .filter((part) => part.unread)
          .sort(
            (one, other) =>
              +(one.unreadSince ?? one.arrivedAt) -
              +(other.unreadSince ?? other.arrivedAt),
          ),
      ) ?? null
    );
  },

  toRead<T extends InboxPart>(parts: readonly T[]): T[] {
    return parts.filter((part) => part.unread);
  },

  toResolve<T extends InboxPart>(parts: readonly T[]): T[] {
    return parts.filter((part) => part.open && part.resolvable);
  },

  // Reopening the item brings back what a person resolved; a part reopens
  // with the item only when a person closed it (see InboxRequest and the
  // conversation's closing note). Nothing comes back while one is open.
  toReopen<T extends InboxPart>(parts: readonly T[]): T[] {
    return parts.some((part) => part.open)
      ? []
      : parts.filter((part) => part.reopenable);
  },
};

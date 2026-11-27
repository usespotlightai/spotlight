import type { InboxItemViewResponseDto } from '@/lib/api';
import type { InboxPart } from '@/lib/inbox';
import {
  type InboxConversation,
  type InboxEntry,
  shown,
  shownConversation,
  type ShownConversation,
} from '@/mocks/world/inbox';

// What the control plane does in TaskInbox, played back for the mock: all
// that waits on a person on one task is one item.

type Kind = InboxPart['kind'];

const KIND_OF_FORM: Record<NonNullable<InboxPart['form']>, Kind> = {
  'judge-disagreement': 'judge-question',
  memories: 'memories',
  alert: 'alert',
};

const blocksTheLine = (kind: Kind): boolean =>
  kind === 'question' || kind === 'failure';

const kindOf = (entry: InboxConversation): Kind => {
  if (entry.inboxRequest) {
    return KIND_OF_FORM[entry.inboxRequest.form];
  }

  return entry.failure ? 'failure' : 'question';
};

const partOf = (entry: ShownConversation): InboxPart => ({
  id: entry.id,
  kind: kindOf(entry),
  form: entry.inboxRequest?.form ?? null,
  about: entry.inboxRequest?.about ?? null,
  at: entry.askedAt,
  open: !entry.resolved,
  unread: entry.unread,
  resolvable: entry.resolvable,
  reopenable: entry.reopenable,
});

const newestFirst = <T extends { readonly askedAt: string }>(
  entries: readonly T[],
): T[] =>
  [...entries].sort(
    (one, other) => Date.parse(other.askedAt) - Date.parse(one.askedAt),
  );

const anchorOf = (
  parts: readonly ShownConversation[],
): ShownConversation | undefined => {
  const conversations = newestFirst(
    parts.filter((each) => each.inboxRequest === null),
  );

  return (
    conversations.find((each) => !each.resolved) ??
    conversations.at(0) ??
    newestFirst(parts).at(0)
  );
};

const latestOf = (unread: readonly ShownConversation[]) => {
  const newest =
    newestFirst(unread).find((each) => blocksTheLine(kindOf(each))) ??
    newestFirst(unread).at(0);

  return newest
    ? {
        kind: kindOf(newest),
        count: unread.filter((each) => kindOf(each) === kindOf(newest)).length,
      }
    : null;
};

const firstUnreadOf = (unread: readonly ShownConversation[]) => {
  const first = newestFirst(unread).at(-1);

  if (!first) {
    return null;
  }

  return {
    partId: first.id,
    position:
      first.inboxRequest === null
        ? (first.notes.find((note) => note.kind === 'asked')?.position ?? null)
        : null,
  };
};

export type ShownGroup = InboxItemViewResponseDto;

const groupOf = (entries: readonly InboxConversation[]): ShownGroup | null => {
  const parts = entries.map(shownConversation);
  const anchor = anchorOf(parts);

  if (!anchor) {
    return null;
  }

  const unread = parts.filter((each) => each.unread);
  const resolved = parts.every((each) => each.resolved);
  const conversation = anchor.inboxRequest === null;
  const { inboxRequest: _request, ...base } = anchor;

  return {
    ...base,
    id: anchor.taskId,
    askedAt: newestFirst(parts).at(0)?.askedAt ?? anchor.askedAt,
    resolved,
    unread: unread.length > 0,
    unreadCount: unread.length,
    section:
      unread.length > 0
        ? anchor.standing === 'following'
          ? 'following'
          : 'open'
        : resolved
          ? 'resolved'
          : anchor.progress === null
            ? 'open'
            : 'running',
    answerable: conversation && anchor.answerable,
    resolvable: parts.some((each) => each.resolvable),
    reopenable: resolved && parts.some((each) => each.reopenable),
    conversationId: conversation ? anchor.id : null,
    latest: latestOf(unread),
    quiet:
      unread.length > 0 &&
      unread.every((each) => kindOf(each) === 'judge-question'),
    parts: [...parts]
      .sort((one, other) => Date.parse(one.askedAt) - Date.parse(other.askedAt))
      .map(partOf),
    firstUnread: firstUnreadOf(unread),
    lastNote: conversation ? (anchor.notes.at(-1) ?? null) : null,
    notes: conversation ? anchor.notes : [],
    folded: conversation ? anchor.folded : [],
  };
};

const partsOfTask = (
  entries: readonly InboxEntry[],
  taskId: string,
): InboxConversation[] =>
  entries.filter(
    (entry): entry is InboxConversation =>
      entry.kind === 'task' && entry.taskId === taskId,
  );

export const groupOfItem = (
  entries: readonly InboxEntry[],
  id: string,
): ShownGroup | null => {
  const part = entries.find(
    (entry): entry is InboxConversation =>
      entry.kind === 'task' && (entry.id === id || entry.taskId === id),
  );

  return part ? groupOf(partsOfTask(entries, part.taskId)) : null;
};

type ListedRow =
  | Omit<ShownGroup, 'notes' | 'folded'>
  | ReturnType<typeof shown>;

export const listed = (
  entries: readonly InboxEntry[],
  resolved: boolean,
): ListedRow[] => {
  const taskIds = [
    ...new Set(
      entries.flatMap((entry) => (entry.kind === 'task' ? [entry.taskId] : [])),
    ),
  ];
  const groups = taskIds.flatMap((taskId) => {
    const group = groupOf(partsOfTask(entries, taskId));

    return group ? [group] : [];
  });
  const open = (entry: { resolved: boolean; unread: boolean }) =>
    !entry.resolved || entry.unread;
  const grouped = new Set(
    groups.filter((group) => open(group)).map((group) => group.taskId),
  );
  const others = entries
    .filter(
      (entry) =>
        entry.kind !== 'task' &&
        !(entry.kind === 'run' && grouped.has(entry.taskId)),
    )
    .map(shown);
  const rows: ListedRow[] = [
    ...groups.map(({ notes: _notes, folded: _folded, ...row }) => row),
    ...others,
  ];

  return newestFirst(rows).filter((entry) =>
    resolved ? entry.resolved : open(entry),
  );
};

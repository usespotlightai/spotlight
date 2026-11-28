import type {
  InboxItemSummary,
  InboxPartSummary,
  InboxRunSummary,
} from '@work/application/ports/inbox-reader.port';
import { inboxSectionOf } from '@work/application/read-models/inbox-section';
import { TaskInbox } from '@work/domain/services/task-inbox';

export type PartItem = Omit<
  InboxItemSummary,
  | 'conversationId'
  | 'unreadCount'
  | 'latest'
  | 'quiet'
  | 'parts'
  | 'firstUnread'
>;

export interface Piece {
  readonly item: PartItem;
  readonly part: InboxPartSummary;
  readonly firstUnreadAt: number | null;
  readonly resolutionKey: string | null;
}

export interface TaskPieces {
  readonly pieces: readonly Piece[];
  readonly run: InboxRunSummary | null;
  readonly newestAt: Date | null;
}

export interface Grouped {
  readonly item: InboxItemSummary;
  readonly arrivedAt: Date;
  readonly interactedAt: Date;
  readonly listedAsOpen: boolean;
  readonly resolutionKey: string | null;
}

const latestKey = (pieces: readonly Piece[]): string | null =>
  pieces.reduce<string | null>(
    (latest, piece) =>
      piece.resolutionKey !== null &&
      (latest === null || piece.resolutionKey > latest)
        ? piece.resolutionKey
        : latest,
    null,
  );

// The item opens on the conversation a link names, else where TaskInbox says.
export const groupOf = (
  found: TaskPieces,
  opensOn?: string,
): Grouped | null => {
  const parts = found.pieces.map((each) => each.part);
  const standing = TaskInbox.standingOf(parts);
  const anchor =
    parts.find(
      (part) => part.id === opensOn && TaskInbox.isConversation(part.kind),
    ) ?? TaskInbox.anchorOf(parts);
  const base = found.pieces.find((each) => each.part === anchor)?.item;

  if (!standing || !anchor || !base) {
    return null;
  }

  const conversation = TaskInbox.isConversation(anchor.kind);
  // Only the conversation the item opens on is shown, so an older one that
  // is still unread is not where it opens.
  const first = TaskInbox.firstUnread(
    parts.filter(
      (part) => part === anchor || !TaskInbox.isConversation(part.kind),
    ),
  );
  const firstPiece = found.pieces.find((each) => each.part === first);
  const run = base.progress === null ? found.run : null;
  const progress = base.progress ?? run?.progress ?? null;
  const unread = standing.unreadCount > 0;
  const resolving = new Set(TaskInbox.toResolve(parts));
  const reopening = new Set(TaskInbox.toReopen(parts));

  return {
    item: {
      ...base,
      id: base.taskId,
      askedAt: standing.interactedAt,
      resolved: standing.resolved,
      section: inboxSectionOf({
        unread,
        resolved: standing.resolved,
        running: progress !== null,
        following: !unread && base.standing === 'following',
      }),
      answerable: conversation && base.answerable,
      resolvable: standing.resolvable,
      reopenable: standing.reopenable,
      progress,
      waiting: base.waiting ?? run?.waiting ?? null,
      runId: base.runId ?? run?.id ?? null,
      stoppableByYou: base.stoppableByYou || (run?.stoppableByYou ?? false),
      unread,
      conversationId: conversation ? anchor.id : null,
      unreadCount: standing.unreadCount,
      latest: standing.latest,
      quiet: standing.quiet,
      parts: [...parts]
        .sort((one, other) => +one.arrivedAt - +other.arrivedAt)
        .map((part) => ({
          ...part,
          resolvable: resolving.has(part),
          reopenable: reopening.has(part),
        })),
      firstUnread:
        first && firstPiece
          ? { partId: first.id, position: firstPiece.firstUnreadAt }
          : null,
    },
    arrivedAt: standing.arrivedAt,
    interactedAt: standing.interactedAt,
    listedAsOpen: standing.listedAsOpen,
    resolutionKey: standing.resolved ? latestKey(found.pieces) : null,
  };
};

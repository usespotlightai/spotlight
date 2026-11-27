import type {
  FoldedVisitResponseDto,
  InboxChatResponseDto,
  InboxPartResponseDto,
  InboxItemResponseDto,
  InboxItemViewResponseDto,
  InboxNoticeResponseDto,
  InboxRunResponseDto,
  JournalledRunResponseDto,
  NoteResponseDto,
  RunJournalResponseDto,
} from '@/lib/api';
import { formatDate } from '@/lib/date-format';
import { OPEN_PREVIEW, RESOLVED_PREVIEW } from '@/lib/judge-disagreement';
import { nonEmpty } from '@/lib/non-empty';
import type { Person } from '@/lib/person';
import type { ShownProgress } from '@/lib/run';
import { teamPath } from '@/lib/team';
import { workspacePath } from '@/lib/workspace';

export type InboxItem = InboxItemResponseDto;

export type InboxItemView = InboxItemViewResponseDto;

export type InboxNotice = InboxNoticeResponseDto;

export type InboxRun = InboxRunResponseDto;

export type InboxChat = InboxChatResponseDto;

export type InboxPart = InboxPartResponseDto;

type InboxPartKind = InboxPart['kind'];

export type InboxEntry = InboxItem | InboxNotice | InboxRun | InboxChat;

// Acts on each part of a task's item. The task's conversations all write the
// one task, so they go one after another; requests go at the same time.
export const actOnParts = async (
  parts: readonly InboxPart[],
  act: (part: InboxPart) => Promise<unknown>,
): Promise<void> => {
  const conversations = parts.filter((part) => part.form === null);
  const requests = parts.filter((part) => part.form !== null);
  const inTurn = async () => {
    for (const part of conversations) {
      await act(part);
    }
  };

  await Promise.all([inTurn(), ...requests.map(act)]);
};

export type ResolvableEntry = InboxItem | InboxNotice | InboxChat;

export type Note = NoteResponseDto;

export type FoldedVisit = FoldedVisitResponseDto;

export type RunPrompt = {
  readonly runId: string;
  readonly text: string;
};

export const authorsOf = (note: Note): Person[] =>
  note.author ? [note.author, ...note.coAuthors] : note.coAuthors;

export type ConversationItem = {
  readonly id: string;
  readonly taskId: string;
  readonly teamId: string | undefined;
  readonly about?: {
    readonly title: string;
    readonly description: string | null;
  };
  readonly createdAt: string;
  readonly station: {
    readonly name: string;
    readonly color: string;
    readonly position: number;
    readonly count: number;
  };
  readonly progress: ShownProgress | null;
  // The harness of its current run, once known.
  readonly harness?: string;
  readonly resolved?: boolean;
  readonly notes: readonly Note[];
  readonly folded: readonly FoldedVisit[];
};

export type RunJournal = RunJournalResponseDto;

export type JournalledRun = JournalledRunResponseDto;

const latestAsk = (notes: readonly Note[]): Note | undefined =>
  notes.findLast((note) => note.kind === 'asked');

export const latestAskPosition = (notes: readonly Note[]): number | null =>
  latestAsk(notes)?.position ?? null;

const closesOrReopens = (note: Note): boolean =>
  note.form === 'resolved' || note.kind === 'reopened';

export const showsInThread = (note: Note): boolean => !closesOrReopens(note);

const NOTES_IN_FIRST_VIEW = 4;

export const runsShownFirst = (item: {
  readonly runId: string | null;
  readonly notes: readonly Note[];
}): (string | null)[] => [
  item.runId,
  ...item.notes
    .filter(showsInThread)
    .slice(-NOTES_IN_FIRST_VIEW)
    .map((note) => note.runId),
];

const answersTo = (notes: readonly Note[], runId: string): number[] => {
  const answers: number[] = [];
  let asked = false;

  for (const note of notes) {
    if (
      note.kind === 'answered' ||
      (note.voice === 'person' && !closesOrReopens(note))
    ) {
      if (asked) {
        answers.push(Date.parse(note.at));
      }
      asked = false;
    } else if (note.runId === runId) {
      asked = true;
    }
  }

  return answers;
};

const spanOf = (steps: readonly JournalStep[]): number => {
  const first = steps.at(0);
  const last = steps.at(-1);

  return first !== undefined && last !== undefined
    ? Date.parse(last.startedAt) + last.ms - Date.parse(first.startedAt)
    : 0;
};

export interface ThreadInput {
  readonly briefing: string | null;
  readonly notes: readonly Note[];
  readonly ran: readonly RunJournal[];
  readonly agent: string;
}

export const ANOTHER_TOOL = 'Another tool';

const authorOf = (note: Note): string => {
  if (note.voice === 'person') {
    return note.author?.name ?? 'Someone';
  }
  if (note.voice === 'world') {
    return ANOTHER_TOOL;
  }
  return note.station;
};

const entryOf = (author: string, text: string): string =>
  `${author}:\n${text.trim()}`;

export const threadText = ({
  briefing,
  notes,
  ran,
  agent,
}: ThreadInput): string => {
  const noteEntries = notes
    .filter((note) => note.body.trim() !== '')
    .map((note) => entryOf(authorOf(note), note.body));
  const messageEntries =
    noteEntries.length > 0
      ? []
      : ran
          .flatMap((journal) => journal.steps)
          .filter((step) => step.kind === 'message' && step.text.trim() !== '')
          .map((step) => entryOf(agent, step.text));

  return [
    ...(briefing !== null && briefing.trim() !== ''
      ? [entryOf('Briefing', briefing)]
      : []),
    ...noteEntries,
    ...messageEntries,
  ].join('\n\n');
};

export const lastNoteAt = (
  notes: readonly Note[],
  ran: readonly RunJournal[],
): string | null =>
  notes.findLast((note) => note.body.trim() !== '')?.at ??
  ran
    .flatMap((journal) => journal.steps)
    .findLast((step) => step.kind === 'message' && step.text.trim() !== '')
    ?.startedAt ??
  null;

export const workedOn = (
  worked: readonly RunJournal[],
  notes: readonly Note[],
  runId: string | null,
  at: string | null = null,
): RunJournal[] => {
  const ran = worked.filter((each) => each.runId === runId);
  const answers = nonEmpty(runId) ? answersTo(notes, runId) : [];

  if (answers.length === 0) {
    return ran;
  }

  const when = at === null ? Number.POSITIVE_INFINITY : Date.parse(at);
  const from =
    answers.findLast((answer) => answer <= when) ?? Number.NEGATIVE_INFINITY;
  const until =
    answers.find((answer) => answer > when) ?? Number.POSITIVE_INFINITY;
  const inside = (moment: number) => moment >= from && moment < until;

  return ran.flatMap((journal) => {
    if (journal.steps.length === 0) {
      const began = journal.marks.startedAt;

      return (
        nonEmpty(began)
          ? inside(Date.parse(began))
          : until === Number.POSITIVE_INFINITY
      )
        ? [journal]
        : [];
    }

    const steps = journal.steps.filter((step) =>
      inside(Date.parse(step.startedAt)),
    );

    if (steps.length === journal.steps.length) {
      return [journal];
    }

    return steps.length === 0 ? [] : [{ ...journal, steps, ms: spanOf(steps) }];
  });
};

export const formatShortDuration = (ms: number): string => {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  const total = Math.round(ms / 1_000);

  if (total < 60) {
    return `${total}s`;
  }
  if (total < 3_600) {
    const seconds = total % 60;
    const minutes = (total - seconds) / 60;

    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const minutes = Math.round(total / 60) % 60;
  const hours = Math.floor(Math.round(total / 60) / 60);

  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

export const counted = (tokens: number): string => {
  if (tokens < 1_000) {
    return `${tokens}`;
  }
  if (Math.round(tokens / 100) < 10_000) {
    return `${Math.round(tokens / 100) / 10}k`;
  }

  return `${Math.round(tokens / 100_000) / 10}M`;
};

const bareAmount = (amount: number): string =>
  amount > 0 && amount < 0.01 ? amount.toFixed(4) : amount.toFixed(2);

export const spentOn = (cost: number | null): string =>
  cost === null ? '–' : `$${bareAmount(cost)}`;

export const spentIn = (amount: number, currency: string): string =>
  currency === 'USD' ? spentOn(amount) : `${amount.toFixed(2)} ${currency}`;

export const amountIn = (amount: number, currency: string | null): string =>
  currency === null ? bareAmount(amount) : spentIn(amount, currency);

export type JournalStep = RunJournalResponseDto['steps'][number];

export const shortTimeOf = (at: string): string =>
  formatDate(new Date(at), {
    hour: 'numeric',
    minute: '2-digit',
  });

export const openedAt = (at: string): string => {
  const opened = new Date(at);
  const time = formatDate(opened, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const today = new Date();
  const sameDay = opened.toDateString() === today.toDateString();

  if (sameDay) {
    return `Today ${time}`;
  }

  const day = formatDate(opened, {
    month: 'short',
    day: 'numeric',
    ...(opened.getFullYear() === today.getFullYear()
      ? {}
      : { year: 'numeric' }),
  });

  return `${day} ${time}`;
};

export const ARRIVING =
  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:ease-out';

export const STICKY_AT_TOP =
  'sticky top-0 z-10 -mx-3 bg-surface pt-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-surface after:to-transparent @max-xl/pane:static @max-xl/pane:after:hidden [@media(max-height:520px)]:static [@media(max-height:520px)]:after:hidden';

export const inboxPath = (slug: string): string => `/w/${slug}/inbox`;

export const inboxItemPath = (
  slug: string,
  id: string,
  runId?: string,
): string =>
  `${inboxPath(slug)}/${encodeURIComponent(id)}${
    nonEmpty(runId) ? `?run=${encodeURIComponent(runId)}` : ''
  }`;

export const inboxRunPath = (
  slug: string,
  teamId: string,
  runId: string,
): string =>
  `${inboxPath(slug)}/teams/${encodeURIComponent(teamId)}/runs/${encodeURIComponent(runId)}`;

export const inboxChatPath = (
  slug: string,
  teamId: string,
  chatId: string,
): string =>
  `${inboxPath(slug)}/teams/${encodeURIComponent(teamId)}/chats/${encodeURIComponent(chatId)}`;

type LiveSession = Pick<RunJournal, 'activity' | 'background'>;

const inProgressWordsOf = (station: string, session?: LiveSession): string => {
  if (session?.activity === 'needs-action') {
    return `${station} needs a permission…`;
  }
  if (session?.activity === 'waiting-for-background') {
    return `${station} waits for background work…`;
  }
  return `${station} is working…`;
};

export const workingWordsOf = (
  progress: ShownProgress,
  station: string,
  session?: LiveSession,
): string => {
  if (progress === 'queued') {
    return `Queued. ${station} starts when a runner is free.`;
  }
  if (progress === 'in-progress') {
    return inProgressWordsOf(station, session);
  }

  return progress === 'finishing'
    ? 'Agent stopped. Finishing the run…'
    : 'Stopping…';
};

export const noticePath = (slug: string, id: string): string =>
  `${inboxPath(slug)}/notices/${encodeURIComponent(id)}`;

export const noticeLinkPath = (slug: string, notice: InboxNotice): string =>
  `${
    notice.linkScope === 'workspace'
      ? workspacePath(slug)
      : teamPath(slug, notice.teamId)
  }/${notice.link.replace(/^\/+/, '')}`;

export const followed = (entry: InboxEntry): boolean =>
  (entry.kind === 'task' || entry.kind === 'run') &&
  entry.standing === 'following';

export const resolvable = (entry: InboxEntry): entry is ResolvableEntry =>
  entry.kind === 'task' || entry.kind === 'notice'
    ? entry.resolvable
    : entry.kind !== 'run' && !entry.resolved;

export const reopenable = (entry: InboxEntry): entry is ResolvableEntry =>
  entry.reopenable;

export const entryKey = (entry: InboxEntry): string =>
  `${entry.kind}:${entry.id}`;

export const chatPreviewOf = (chat: InboxChat): string => {
  if (chat.progress) {
    return workingWordsOf(chat.progress, 'Agent');
  }
  if (chat.resolved) {
    return 'Chat resolved.';
  }

  return chat.openProposals > 0
    ? `${chat.openProposals} task ${chat.openProposals === 1 ? 'proposal' : 'proposals'} waiting for you.`
    : 'Waiting for you.';
};

export const NOTICE_POINTS_LABEL = 'Details';

export const GONE_FROM_INBOX = 'No longer waiting for you.';

export const noticePreviewOf = (notice: InboxNotice): string =>
  notice.points[0] ?? '';

export const shownAt = (
  notes: readonly Note[],
  runId: string | null,
): number | null =>
  notes.find((note) => nonEmpty(runId) && note.runId === runId)?.position ??
  null;

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? one : `${count} ${many}`;

const askedBody = (item: InboxItem): string | null => {
  const asked = item.lastNote;

  if (!asked) {
    return null;
  }

  return asked.form === 'setup' ? (item.description ?? '') : asked.body;
};

const waitingPreviewOf = (
  item: InboxItem,
  kind: InboxPartKind,
  count: number,
): string => {
  switch (kind) {
    case 'question':
    case 'failure': {
      const body = askedBody(item);

      if (body === null) {
        return `Waiting at ${item.station}`;
      }

      // Only a note the station wrote is its question; a person's answer or
      // a note from outside Spotlight is shown as it is.
      if (item.lastNote?.voice !== 'station') {
        return body;
      }

      return kind === 'failure'
        ? `${item.station} stopped: ${body}`
        : `${item.station} asks: ${body}`;
    }
    case 'judge-question':
      return plural(count, OPEN_PREVIEW, 'judge questions');
    case 'memories':
      return plural(
        count,
        'A run proposed memories for the team.',
        'runs proposed memories',
      );
    case 'alert':
      return plural(count, 'Station alert fired.', 'station alerts fired');
  }
};

const settledPreviewOf = (item: InboxItem, part: InboxPart): string => {
  switch (part.kind) {
    case 'question':
    case 'failure':
      return askedBody(item) ?? `Waiting at ${item.station}`;
    case 'judge-question':
      return RESOLVED_PREVIEW;
    case 'memories':
      return 'Proposed memories decided.';
    case 'alert':
      return 'Station alert resolved.';
  }
};

const shownPartOf = (item: InboxItem): InboxPart | undefined =>
  item.parts.find((part) => part.id === item.conversationId) ??
  item.parts.findLast((part) => part.open) ??
  item.parts.at(-1);

export const previewOf = (item: InboxItem): string => {
  if (item.latest) {
    return waitingPreviewOf(item, item.latest.kind, item.latest.count);
  }

  const shown = shownPartOf(item);

  if (!shown) {
    return askedBody(item) ?? `Waiting at ${item.station}`;
  }

  // Nothing waits on a person: the latest note, or how its parts settled.
  return shown.open
    ? (askedBody(item) ?? `Waiting at ${item.station}`)
    : settledPreviewOf(item, shown);
};

export const unreadCountOf = (entries: readonly InboxEntry[]): number =>
  entries.reduce((sum, entry) => sum + entry.unreadCount, 0);

export const requestPartsOf = (item: InboxItem): InboxPart[] =>
  item.parts.filter((part) => part.form !== null);

export const conversationClosed = (
  item: InboxItem,
  conversationId: string,
): boolean =>
  !item.parts.some((part) => part.id === conversationId && part.open);

export const firstUnreadNoteOf = (item: InboxItem): number | null =>
  item.firstUnread && item.firstUnread.partId === item.conversationId
    ? item.firstUnread.position
    : null;

export const answerPlaceholder = (station: string): string =>
  `${station} reads your answer and decides the next step…`;

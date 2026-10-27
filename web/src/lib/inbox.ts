import type {
  InboxItemResponseDto,
  InboxNoticeResponseDto,
  NoteResponseDto,
  RunJournalResponseDto,
} from '@/lib/api';
import type { Person } from '@/lib/person';
import type { ShownProgress } from '@/lib/run';
import { teamPath } from '@/lib/team';

export type InboxItem = InboxItemResponseDto;

export type InboxNotice = InboxNoticeResponseDto;

export type InboxEntry = InboxItem | InboxNotice;

export type Note = NoteResponseDto;

export const authorsOf = (note: Note): Person[] =>
  note.author ? [note.author, ...note.coAuthors] : note.coAuthors;

export type ConversationItem = {
  readonly id: string;
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
  readonly resolved?: boolean;
  readonly notes: readonly Note[];
};

export type RunJournal = RunJournalResponseDto;

export const decisionPending = (notes: readonly Note[]): boolean =>
  notes.findLast((note) => note.kind === 'asked')?.form === 'approval';

const answersTo = (notes: readonly Note[], runId: string): number[] => {
  const answers: number[] = [];
  let asked = false;

  for (const note of notes) {
    if (note.kind === 'answered' || note.voice === 'person') {
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
  const first = steps[0];
  const last = steps[steps.length - 1];

  return first && last
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
    .filter((note) => note.body.trim())
    .map((note) => entryOf(authorOf(note), note.body));
  const messageEntries =
    noteEntries.length > 0
      ? []
      : ran
          .flatMap((journal) => journal.steps)
          .filter((step) => step.kind === 'message' && step.text.trim())
          .map((step) => entryOf(agent, step.text));

  return [
    ...(briefing?.trim() ? [entryOf('Briefing', briefing)] : []),
    ...noteEntries,
    ...messageEntries,
  ].join('\n\n');
};

export const lastNoteAt = (
  notes: readonly Note[],
  ran: readonly RunJournal[],
): string | null =>
  notes.findLast((note) => note.body.trim())?.at ??
  ran
    .flatMap((journal) => journal.steps)
    .findLast((step) => step.kind === 'message' && step.text.trim())
    ?.startedAt ??
  null;

export const workedOn = (
  worked: readonly RunJournal[],
  notes: readonly Note[],
  runId: string | null,
  at: string | null = null,
): RunJournal[] => {
  const ran = worked.filter((each) => each.runId === runId);
  const answers = runId ? answersTo(notes, runId) : [];

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
        began
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
  if (ms < 60_000) {
    return `${Math.round(ms / 1_000)}s`;
  }

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1_000);

  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
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
  new Date(at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

export const openedAt = (at: string): string => {
  const opened = new Date(at);
  const time = opened.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const today = new Date();
  const sameDay = opened.toDateString() === today.toDateString();

  if (sameDay) {
    return `Today ${time}`;
  }

  const day = opened.toLocaleDateString(undefined, {
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
  'sticky top-0 z-10 -mx-3 bg-surface pt-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-surface after:to-transparent';

export const inboxPath = (slug: string) => `/w/${slug}/inbox`;

export const inboxItemPath = (slug: string, id: string, runId?: string) =>
  `${inboxPath(slug)}/${encodeURIComponent(id)}${
    runId ? `?run=${encodeURIComponent(runId)}` : ''
  }`;

export const noticePath = (slug: string, id: string) =>
  `${inboxPath(slug)}/notices/${encodeURIComponent(id)}`;

export const noticeLinkPath = (slug: string, notice: InboxNotice) =>
  `${teamPath(slug, notice.teamId)}/${notice.link.replace(/^\/+/, '')}`;

export const taskItemOf = (
  entries: readonly InboxEntry[] | undefined,
  id: string | undefined,
): InboxItem | undefined =>
  entries?.find(
    (each): each is InboxItem => each.kind === 'task' && each.id === id,
  );

export const noticeOf = (
  entries: readonly InboxEntry[] | undefined,
  id: string | undefined,
): InboxNotice | undefined =>
  entries?.find(
    (each): each is InboxNotice => each.kind === 'notice' && each.id === id,
  );

export const NOTICE_POINTS_LABEL = 'Details';

export const GONE_FROM_INBOX = 'No longer waiting for you.';

export const noticePreviewOf = (notice: InboxNotice): string =>
  notice.points[0] ?? '';

export const shownAt = (
  notes: readonly Note[],
  runId: string | null,
): number | null =>
  notes.find((note) => runId && note.runId === runId)?.position ?? null;

export const previewOf = (item: InboxItem): string => {
  if (item.inboxRequest?.form === 'memories') {
    return item.resolved
      ? 'Proposed memories decided.'
      : 'A run proposed memories for the team.';
  }

  if (item.inboxRequest?.form === 'alert') {
    return item.resolved ? 'Station alert resolved.' : 'Station alert fired.';
  }

  if (item.inboxRequest?.form === 'grade') {
    return item.resolved
      ? 'Run graded.'
      : 'A judged run needs your grade. Grades check the judge.';
  }

  const asked = item.notes[item.notes.length - 1];

  if (!asked) {
    return `Waiting at ${item.station}`;
  }

  return asked.form === 'setup' ? (item.description ?? '') : asked.body;
};

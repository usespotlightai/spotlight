import type {
  InboxItemResponseDto,
  InboxMessageResponseDto,
  RunJournalResponseDto,
} from '@/lib/api';

export type InboxItem = InboxItemResponseDto;

export type InboxMessage = InboxMessageResponseDto;

export type Conversing = {
  readonly id: string;
  readonly teamId: string | undefined;
  // What was asked, where a note carries the opening rather than standing
  // under it.
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
  readonly working: boolean;
  readonly notes: readonly InboxMessage[];
};

export type RunJournal = RunJournalResponseDto;

export const took = (ms: number): string => {
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

export const counted = (tokens: number): string =>
  tokens < 1_000 ? `${tokens}` : `${Math.round(tokens / 100) / 10}k`;

export const spentOn = (cost: number | null): string =>
  cost === null ? '–' : `$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`;

export type JournalStep = RunJournalResponseDto['steps'][number];

export const spokenAt = (at: string): string =>
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

/**
 * What holds a person's words at the top while the work below them scrolls
 * past. It has to sit on the element the conversation lays out directly — a
 * box only travels within its parent's, and a wrapper hugging the card has
 * nowhere to travel. The inset is what the card's own padding cancels.
 */
export const HELD_AT_TOP =
  'sticky top-0 z-10 -mx-3 bg-card pt-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-card after:to-transparent';

export const inboxPath = (slug: string) => `/w/${slug}/inbox`;

export const inboxItemPath = (slug: string, id: string, runId?: string) =>
  `${inboxPath(slug)}/${encodeURIComponent(id)}${
    runId ? `?run=${encodeURIComponent(runId)}` : ''
  }`;

export const shownAt = (
  notes: readonly InboxMessage[],
  runId: string | null,
): number | null =>
  notes.find((note) => runId && note.runId === runId)?.position ?? null;

export const waitingOn = (item: InboxItem) => item.notes[item.notes.length - 1];

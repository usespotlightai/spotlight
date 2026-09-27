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
  readonly resolved?: boolean;
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

export const HELD_AT_TOP =
  'sticky top-0 z-10 -mx-3 bg-surface pt-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-surface after:to-transparent';

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

export const previewOf = (item: InboxItem): string => {
  if (item.aside?.form === 'memories') {
    return item.resolved
      ? 'The memories a run proposed are decided.'
      : 'A run proposed memories for the team to keep.';
  }

  const asked = item.notes[item.notes.length - 1];

  if (!asked) {
    return `Waiting at ${item.station}`;
  }

  return asked.form === 'setup' ? (item.description ?? '') : asked.body;
};

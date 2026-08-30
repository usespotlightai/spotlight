import type {
  InboxItemResponseDto,
  InboxMessageResponseDto,
  RunJournalResponseDto,
} from '@/lib/api';

export type InboxItem = InboxItemResponseDto;

/** One thing said about a task. A person said it where there is an author. */
export type InboxMessage = InboxMessageResponseDto;

/** What one run did, as the journal reads it. */
export type RunJournal = RunJournalResponseDto;

/** How long something took, in as few characters as say it. */
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

/** Tokens, at the size anyone reads them. */
export const counted = (tokens: number): string =>
  tokens < 1_000 ? `${tokens}` : `${Math.round(tokens / 100) / 10}k`;

/** One thing the agent said, thought, or did. */
export type JournalStep = RunJournalResponseDto['steps'][number];

/** A time of day, for something said within one sitting. */
export const spokenAt = (at: string): string =>
  new Date(at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

/** When the conversation started, shown once above it rather than per message. */
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
export const HELD_AT_TOP = 'sticky top-0 z-10 -mx-3 bg-card pt-2';

export const inboxPath = (slug: string) => `/w/${slug}/inbox`;

/** A stretch is named by its own id, since a task can hold more than one. */
export const inboxItemPath = (slug: string, id: string) =>
  `${inboxPath(slug)}/${encodeURIComponent(id)}`;

/** What the task is waiting on: the last thing anything said about it. */
export const waitingOn = (item: InboxItem) => item.notes[item.notes.length - 1];

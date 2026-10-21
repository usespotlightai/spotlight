import type { RunNotesResponseDto } from '@/lib/api';
import {
  type ConversationItem,
  type RunJournal,
  threadText,
} from '@/lib/inbox';
import type { Person } from '@/lib/person';
import {
  type Progress,
  type TeamRun,
  underway,
  waitsOnPerson,
} from '@/lib/run';

export type RunNotes = RunNotesResponseDto;

export type LatestRun = RunNotes['latestRun'];

export type OutgoingMessage = {
  readonly teamId: string;
  readonly runId: string;
  readonly body: string;
  readonly attachments: string[];
  readonly answers?: boolean;
  readonly startsWork?: boolean;
};

export type MessageInFlight = OutgoingMessage & { readonly sentAt: number };

const CLOCK_SKEW_MS = 60_000;

const stillOnTheirWay = (
  conversation: RunNotes,
  inFlight: readonly MessageInFlight[],
  me: Person | null,
): MessageInFlight[] => {
  const matched = new Set<number>();

  return inFlight.filter((message) => {
    const body = message.body.trim();
    const saved = conversation.notes.find(
      (note) =>
        !matched.has(note.position) &&
        note.voice === 'person' &&
        note.author?.id === me?.id &&
        body !== '' &&
        note.body === body &&
        Date.parse(note.at) >= message.sentAt - CLOCK_SKEW_MS,
    );

    if (saved) {
      matched.add(saved.position);
    }

    return !saved;
  });
};

const UNCOLOURED = '#a3a8b0';

export const withMessagesInFlight = (
  conversation: RunNotes,
  inFlight: readonly MessageInFlight[],
  me: Person | null,
): RunNotes => {
  const messages = stillOnTheirWay(conversation, inFlight, me);

  if (messages.length === 0) {
    return conversation;
  }

  const after = conversation.notes.at(-1)?.position ?? -1;

  return {
    ...conversation,
    progress:
      conversation.progress ??
      (messages.some((each) => each.startsWork) ? 'queued' : null),
    notes: [
      ...conversation.notes,
      ...messages.map((message, at) => ({
        position: after + 1 + at,
        kind: message.answers ? ('answered' as const) : ('message' as const),
        form: 'words' as const,
        voice: 'person' as const,
        station: conversation.station?.name ?? '',
        stationColor: conversation.station?.color ?? UNCOLOURED,
        stationPosition: conversation.station?.position ?? 0,
        runId: null,
        body: message.body,
        attachments: [],
        at: new Date(message.sentAt).toISOString(),
        author: me,
        approval: null,
        failure: null,
        connection: null,
      })),
    ],
  };
};

export const conversationItemOf = (
  conversation: RunNotes,
  teamId: string,
  progress: Progress | null,
): ConversationItem => ({
  id: conversation.runId,
  teamId,
  createdAt: conversation.createdAt,
  station: {
    name: conversation.station?.name ?? '',
    color: conversation.station?.color ?? UNCOLOURED,
    position: conversation.station?.position ?? 0,
    count: conversation.station?.count ?? 1,
  },
  progress,
  notes: conversation.notes,
});

export const followedOnAfter = (
  notes: readonly {
    readonly position: number;
    readonly runId: string | null;
  }[],
  runId: string,
): number | null => {
  const closesAt = lastNoteOf(notes, runId);

  return closesAt !== null && notes.some((note) => note.position > closesAt)
    ? closesAt
    : null;
};

export const lastNoteOf = (
  notes: readonly {
    readonly position: number;
    readonly runId: string | null;
  }[],
  runId: string,
): number | null =>
  notes.findLast((each) => each.runId === runId)?.position ?? null;

export const runThreadText = (
  conversation: RunNotes | undefined,
  run: TeamRun,
  ran: readonly RunJournal[],
): string =>
  threadText({
    briefing:
      conversation?.briefing ||
      [
        conversation?.title ?? run.taskTitle,
        conversation?.description ?? run.taskDescription,
      ]
        .filter(Boolean)
        .join('\n\n'),
    notes: conversation?.notes ?? [],
    ran,
    agent: run.station?.name ?? 'The agent',
  });

export const stayedQuiet = (
  run: TeamRun,
  ran: readonly RunJournal[],
  journalFailed: boolean,
): boolean =>
  !underway(run) &&
  !waitsOnPerson(run) &&
  !journalFailed &&
  ran.every((each) => each.steps.length === 0);

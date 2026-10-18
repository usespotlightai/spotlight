import type { RunNotesResponseDto } from '@/lib/api';
import {
  type ConversationItem,
  type RunJournal,
  threadText,
} from '@/lib/inbox';
import { type TeamRun, waitsOnPerson, working } from '@/lib/run';

export type RunNotes = RunNotesResponseDto;

const UNCOLOURED = '#a3a8b0';

export const conversationItemOf = (
  conversation: RunNotes,
  teamId: string,
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
  working: conversation.working,
  notes: conversation.notes,
});

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
  !working(run) &&
  !waitsOnPerson(run) &&
  !journalFailed &&
  ran.every((each) => each.steps.length === 0);

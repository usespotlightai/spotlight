import type { RunConversationResponseDto } from '@/lib/api';
import { type Conversing, type RunJournal, threadText } from '@/lib/inbox';
import { type TeamRun, waitsOnPerson, working } from '@/lib/run';

export type RunConversation = RunConversationResponseDto;

const UNCOLOURED = '#a3a8b0';

export const conversingOf = (
  said: RunConversation,
  teamId: string,
): Conversing => ({
  id: said.runId,
  teamId,
  createdAt: said.createdAt,
  station: {
    name: said.station?.name ?? '',
    color: said.station?.color ?? UNCOLOURED,
    position: said.station?.position ?? 0,
    count: said.station?.count ?? 1,
  },
  working: said.working,
  notes: said.notes,
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
  said: RunConversation | undefined,
  run: TeamRun,
  ran: readonly RunJournal[],
): string =>
  threadText({
    opening:
      said?.briefing ||
      [said?.title ?? run.taskTitle, said?.description ?? run.taskDescription]
        .filter(Boolean)
        .join('\n\n'),
    notes: said?.notes ?? [],
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

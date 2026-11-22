import type {
  HoldEnd,
  TaskHoldResponseDto,
  LineResponseDto,
  StationResponseDto,
  HoldVerdict,
} from '@/lib/api';
import { chatPath } from '@/lib/chat';
import type { Note } from '@/lib/inbox';
import { runPath } from '@/lib/run';
import { since } from '@/lib/since';
import type { Task } from '@/lib/task';

type Choice<T> = {
  readonly value: T;
  readonly label: string;
  readonly description: string;
};

export const HOLD_VERDICTS: readonly Choice<HoldVerdict>[] = [
  {
    value: 'not-right',
    label: 'The line got it wrong',
    description: 'Counts against the last run at this station.',
  },
  {
    value: 'exploring',
    label: 'I want to try something',
    description: 'Does not count against the line.',
  },
];

export const moveOnTargets = (
  stations: readonly StationResponseDto[],
  station: StationResponseDto,
): StationResponseDto[] => {
  const next = new Set(station.passesTo);

  return stations.filter((each) => Boolean(each.harness) && next.has(each.id));
};

export const holdPathOf = (
  slug: string,
  teamId: string,
  hold: TaskHoldResponseDto,
): string | undefined =>
  hold.chatId
    ? chatPath(slug, teamId, hold.chatId)
    : hold.runId
      ? runPath(slug, teamId, hold.runId)
      : undefined;

export const heldUntilResumed = (
  hold: TaskHoldResponseDto,
  viewerId: string | undefined,
): string =>
  hold.chatId
    ? hold.by.id === viewerId
      ? `Your agent chat opened the pull request of this task ${since(hold.startedAt)}. The line continues when you hand the task to the line.`
      : `The agent chat of ${hold.by.name} opened the pull request of this task ${since(hold.startedAt)}. The line continues when they hand the task to the line.`
    : `${hold.by.id === viewerId ? 'You' : hold.by.name} put the task on hold ${since(hold.startedAt)}. The line continues when a person on the team resumes it.`;

export const lockedHold = (
  hold: TaskHoldResponseDto | null | undefined,
): TaskHoldResponseDto | null => (hold && !hold.viewerEnds ? hold : null);

export const heldBecause = (verdict: HoldVerdict): string =>
  verdict === 'exploring'
    ? 'The task is on hold to try something.'
    : 'The task is on hold because the line got it wrong.';

export const resumedTo = (
  next: HoldEnd,
  station: StationResponseDto,
  to: StationResponseDto | undefined,
  held: StationResponseDto | null,
): string => {
  if (
    next === 'finish' ||
    (next === 'continue' && held?.kind === 'completed')
  ) {
    return 'The task is completed.';
  }
  if (next === 'move-on' && to) {
    return `The task moved to ${to.name}.`;
  }
  return `${station.name} runs again with your changes.`;
};

export const resumeNotePrompt = (
  next: HoldEnd,
  station: StationResponseDto,
  to: StationResponseDto | undefined,
  held: StationResponseDto | null,
): string => {
  if (
    next === 'finish' ||
    (next === 'continue' && held?.kind === 'completed')
  ) {
    return 'Note for your team (optional)';
  }
  if (next === 'move-on' && to) {
    return `What should ${to.name} know? (optional)`;
  }
  return `What should ${station.name} do next? (optional)`;
};

export const resumeAction = (next: HoldEnd): string => {
  if (next === 'move-on') {
    return 'Move it on';
  }
  if (next === 'finish') {
    return 'Finish the task';
  }
  return 'Resume';
};

export const heldMoveOf = (
  line: LineResponseDto | undefined,
  task: Task,
): StationResponseDto | null =>
  line?.stations.find((each) => each.id === task.hold?.heldMoveTo) ?? null;

const givenBack = (
  station: StationResponseDto,
  held: StationResponseDto | null,
): Choice<HoldEnd> => {
  if (held?.kind === 'completed') {
    return {
      value: 'continue',
      label: 'Resume the line',
      description:
        'An event asked to finish the task while it was on hold. The task moves to Completed. Spotlight does not push your commits.',
    };
  }

  return {
    value: 'continue',
    label: `Resume at ${station.name}`,
    description: held
      ? `The station agent reads your changes and continues. Then the task moves to ${held.name}, as an event asked while it was on hold.`
      : 'The station agent reads your changes and continues.',
  };
};

export const resumeChoices = (
  station: StationResponseDto,
  moveOn: readonly StationResponseDto[],
  held: StationResponseDto | null,
): Choice<HoldEnd>[] => [
  givenBack(station, held),
  ...(moveOn.length > 0
    ? [
        {
          value: 'move-on' as const,
          label:
            moveOn.length === 1
              ? `Move on to ${moveOn[0]?.name}`
              : 'Move it on',
          description: 'Your changes are the work of this station.',
        },
      ]
    : []),
  ...(held?.kind === 'completed'
    ? []
    : [
        {
          value: 'finish' as const,
          label: 'Finish the task',
          description:
            'The task moves to Completed. Spotlight does not push your commits.',
        },
      ]),
];

export const marksHold = (note: Note): boolean =>
  note.form === 'held' || note.form === 'resumed';

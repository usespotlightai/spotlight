import type {
  HandBack,
  TaskTakeoverResponseDto,
  LineResponseDto,
  StationResponseDto,
  TakeoverVerdict,
} from '@/lib/api';
import type { Note } from '@/lib/inbox';
import { since } from '@/lib/since';
import type { Task } from '@/lib/task';

type Choice<T> = {
  readonly value: T;
  readonly label: string;
  readonly description: string;
};

export const TAKEOVER_VERDICTS: readonly Choice<TakeoverVerdict>[] = [
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

export const mayTakeOver = (
  task: Task,
  station: StationResponseDto | undefined,
  member: boolean,
): boolean =>
  Boolean(
    member && station?.kind === 'work' && station.harness && !task.takeover,
  );

export const moveOnTargets = (
  stations: readonly StationResponseDto[],
  station: StationResponseDto,
): StationResponseDto[] =>
  stations.filter(
    (each) => Boolean(each.harness) && station.passesTo.includes(each.id),
  );

export const heldUntilHandedBack = (
  takeover: TaskTakeoverResponseDto,
  viewerId: string | undefined,
): string =>
  takeover.by.id === viewerId
    ? `You took over ${since(takeover.startedAt)}. You have this task until you hand it back.`
    : `${takeover.by.name} took over ${since(takeover.startedAt)}. They have this task until they hand it back.`;

export const heldByOther = (
  takeover: TaskTakeoverResponseDto | null | undefined,
  viewerId: string | undefined,
): TaskTakeoverResponseDto | null =>
  takeover && takeover.by.id !== viewerId ? takeover : null;

export const heldByMe = (
  takeover: TaskTakeoverResponseDto | null | undefined,
  viewerId: string | undefined,
): boolean => Boolean(takeover && takeover.by.id === viewerId);

export const tookOverBecause = (verdict: TakeoverVerdict): string =>
  verdict === 'exploring'
    ? 'You took over to try something.'
    : 'You took over because the line got it wrong.';

export const handedBackTo = (
  next: HandBack,
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

export const handBackNotePrompt = (
  next: HandBack,
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

export const handBackAction = (next: HandBack): string => {
  if (next === 'move-on') {
    return 'Move it on';
  }
  if (next === 'finish') {
    return 'Finish the task';
  }
  return 'Hand it back';
};

export const heldMoveOf = (
  line: LineResponseDto | undefined,
  task: Task,
): StationResponseDto | null =>
  line?.stations.find((each) => each.id === task.takeover?.heldMoveTo) ?? null;

const givenBack = (
  station: StationResponseDto,
  held: StationResponseDto | null,
): Choice<HandBack> => {
  if (held?.kind === 'completed') {
    return {
      value: 'continue',
      label: 'Hand it back to the line',
      description:
        'An event asked to finish the task while you had it. The task moves to Completed. Spotlight does not push your commits.',
    };
  }

  return {
    value: 'continue',
    label: `Hand it back to ${station.name}`,
    description: held
      ? `The station agent reads your changes and continues. Then the task moves to ${held.name}, as an event asked while you had it.`
      : 'The station agent reads your changes and continues.',
  };
};

export const handBackChoices = (
  station: StationResponseDto,
  moveOn: readonly StationResponseDto[],
  held: StationResponseDto | null,
): Choice<HandBack>[] => [
  givenBack(station, held),
  ...(moveOn.length > 0
    ? [
        {
          value: 'move-on' as const,
          label:
            moveOn.length === 1
              ? `Move it on to ${moveOn[0]?.name}`
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

export const marksTakeover = (note: Note): boolean =>
  note.form === 'took-over' || note.form === 'handed-back';

import type {
  HandBack,
  TaskTakeoverResponseDto,
  LineResponseDto,
  StationResponseDto,
  TakeoverVerdict,
} from '@/lib/api';
import type { Note } from '@/lib/inbox';
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

export const heldUntilGivenBack = (
  takeover: TaskTakeoverResponseDto,
  viewerId: string | undefined,
): string =>
  takeover.by.id === viewerId
    ? 'You have this task until you give it back.'
    : `${takeover.by.name} has this task until they give it back.`;

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
      label: 'Give it back to the line',
      description:
        'An event asked to finish the task while you had it. The task moves to Completed.',
    };
  }

  return {
    value: 'continue',
    label: `Give it back to ${station.name}`,
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
          label: 'Move it on',
          description: 'Your changes are the work of this station.',
        },
      ]
    : []),
  {
    value: 'finish',
    label: 'Finish the task',
    description: 'The task moves to Completed.',
  },
];

export const marksTakeover = (note: Note): boolean =>
  note.form === 'took-over' || note.form === 'handed-back';

import type { MoveMaker } from '@work/domain/value-objects/note-move.vo';

export const MOVE_MAKER_NAMES = [
  'line',
  'person',
  'run',
] as const satisfies readonly MoveMaker[];

interface TaskMovePersonDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface TaskMoveDto {
  readonly position: number;
  readonly at: string;
  readonly station: string | null;
  readonly by: MoveMaker;
  readonly person: TaskMovePersonDto | null;
  readonly why: string | null;
}

import type { MoveRefusal } from '@work/domain/value-objects/line-refusal';

const WHY: Record<MoveRefusal, string> = {
  'out-of-completed': 'A completed task stays completed.',
  'between-work-stations': 'Only runs move a task between work stations.',
};

export class MoveRefusedError extends Error {
  readonly violation = 'invalid' as const;

  constructor(refusal: MoveRefusal, from: string, to: string) {
    super(`Task cannot move from ${from} to ${to}. ${WHY[refusal]}`);
    this.name = 'MoveRefusedError';
  }
}

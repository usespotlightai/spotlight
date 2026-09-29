import type { MoveRefusal } from '@work/domain/value-objects/line-refusal';

const WHY: Record<MoveRefusal, string> = {
  'out-of-completed': 'a completed task stays completed',
  'between-work-stations':
    'a person starts a task from the backlog, parks it back there or closes it, and its runs pass it between work stations',
};

export class MoveRefusedError extends Error {
  readonly violation = 'invalid' as const;

  constructor(refusal: MoveRefusal, from: string, to: string) {
    super(`The task cannot be moved from ${from} to ${to}: ${WHY[refusal]}`);
    this.name = 'MoveRefusedError';
  }
}

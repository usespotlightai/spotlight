import type { MoveDenial } from '@work/domain/value-objects/line-denial';

const WHY: Record<MoveDenial, string> = {
  'out-of-completed': 'A completed task stays completed.',
  'between-work-stations': 'Only runs move a task between work stations.',
};

export class MoveDeniedError extends Error {
  readonly kind = 'invalid' as const;

  constructor(denial: MoveDenial, from: string, to: string) {
    super(`Task cannot move from ${from} to ${to}. ${WHY[denial]}`);
    this.name = 'MoveDeniedError';
  }
}

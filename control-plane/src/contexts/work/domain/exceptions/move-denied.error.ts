import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { MoveDenial } from '@work/domain/value-objects/line-denial';

const WHY: Record<MoveDenial, string> = {
  'out-of-completed': 'A completed task stays completed.',
  'between-work-stations':
    'Only runs move a task between work stations. A person can send a finished task back to an earlier station, or to a station that its station passes to.',
};

export class MoveDeniedError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(denial: MoveDenial, from: string, to: string) {
    super(`Task cannot move from ${from} to ${to}. ${WHY[denial]}`);
    this.name = 'MoveDeniedError';
  }
}

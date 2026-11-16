import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class HoldConflictError extends ApplicationError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'HoldConflictError';
  }
}

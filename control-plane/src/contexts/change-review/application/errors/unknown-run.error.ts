import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class UnknownRunError extends ApplicationError {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`Run ${runId} is not a run this runner works.`);
    this.name = 'UnknownRunError';
  }
}

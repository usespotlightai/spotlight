import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class ChangeStacksUnavailableError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor() {
    super('Change stacks are not set up on this deployment.');
    this.name = 'ChangeStacksUnavailableError';
  }
}

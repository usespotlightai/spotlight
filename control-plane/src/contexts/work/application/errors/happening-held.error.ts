import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class HappeningHeldError extends ApplicationError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'A task this word is for is still deciding what its run handed over. Send it again shortly.',
    );
    this.name = 'HappeningHeldError';
  }
}

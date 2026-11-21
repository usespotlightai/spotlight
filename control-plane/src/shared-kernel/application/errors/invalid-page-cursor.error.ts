import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class InvalidPageCursorError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Sorry, the page cursor is not valid.');
    this.name = 'InvalidPageCursorError';
  }
}

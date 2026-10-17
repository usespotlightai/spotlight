import type { ErrorKind } from '@shared-kernel/domain/exceptions/error-kind';

export class ApplicationError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

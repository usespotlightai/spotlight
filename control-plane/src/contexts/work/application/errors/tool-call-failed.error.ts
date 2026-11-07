import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class ToolCallFailedError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'ToolCallFailedError';
  }
}

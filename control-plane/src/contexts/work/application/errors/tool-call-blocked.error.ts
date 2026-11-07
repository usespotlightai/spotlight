import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class ToolCallBlockedError extends ApplicationError {
  readonly kind = 'not-allowed' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'ToolCallBlockedError';
  }
}

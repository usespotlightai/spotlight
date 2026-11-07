import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ToolConnectionDeniedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(tool: string, reason: string) {
    super(`${tool} was not used, so nothing was sent: ${reason}`);
    this.name = 'ToolConnectionDeniedError';
  }
}

import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ToolNotEnabledError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(tool: string) {
    super(`This run does not have ${tool} enabled`);
    this.name = 'ToolNotEnabledError';
  }
}

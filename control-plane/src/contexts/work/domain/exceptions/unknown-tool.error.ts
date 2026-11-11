import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownToolError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(tool: string) {
    super(`Tool ${tool} not found.`);
    this.name = 'UnknownToolError';
  }
}

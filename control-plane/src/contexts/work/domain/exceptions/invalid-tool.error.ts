import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidToolError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(tool: string, because: string) {
    super(`Tool ${tool} ${because}.`);
    this.name = 'InvalidToolError';
  }
}

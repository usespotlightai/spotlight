import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidAgentPromptError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Agent prompt ${reason}.`);
    this.name = 'InvalidAgentPromptError';
  }
}

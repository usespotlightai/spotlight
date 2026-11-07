import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidVoiceError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Voice ${reason}.`);
    this.name = 'InvalidVoiceError';
  }
}

import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReplayCheckError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Replay check ${reason}.`);
    this.name = 'InvalidReplayCheckError';
  }
}

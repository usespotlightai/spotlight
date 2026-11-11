import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReplayError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Replay ${reason}.`);
    this.name = 'InvalidReplayError';
  }
}

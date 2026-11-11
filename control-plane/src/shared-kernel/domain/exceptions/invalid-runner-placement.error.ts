import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunnerPlacementError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runners ${because}.`);
    this.name = 'InvalidRunnerPlacementError';
  }
}

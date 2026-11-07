import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplayCheckUnconfiguredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(lineKey: string) {
    super(
      `Line ${lineKey} has no replay_check block. Please add one with max_regressions, ceiling and currency.`,
    );
    this.name = 'ReplayCheckUnconfiguredError';
  }
}

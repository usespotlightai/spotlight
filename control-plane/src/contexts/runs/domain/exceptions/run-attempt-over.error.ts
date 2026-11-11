import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunAttemptOverError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Run ${runId} is no longer on attempt ${attempt} for this runner, so nothing more is done for that attempt`,
    );
    this.name = 'RunAttemptOverError';
  }
}

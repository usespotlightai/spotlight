import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ChangeJudgingVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(
      `Judging of the change of run ${runId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ChangeJudgingVersionConflictError';
  }
}

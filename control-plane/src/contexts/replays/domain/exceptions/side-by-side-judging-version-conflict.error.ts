import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SideBySideJudgingVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string, otherRunId: string) {
    super(
      `Side-by-side judging of run ${runId} and run ${otherRunId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SideBySideJudgingVersionConflictError';
  }
}

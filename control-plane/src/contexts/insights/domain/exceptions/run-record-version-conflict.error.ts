import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunRecordVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(
      `Record of run ${runId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunRecordVersionConflictError';
  }
}

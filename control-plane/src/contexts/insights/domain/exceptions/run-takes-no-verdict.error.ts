import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunTakesNoVerdictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(
      `Run ${runId} takes no verdict: it has not finished, or it ended before it ran.`,
    );
    this.name = 'RunTakesNoVerdictError';
  }
}

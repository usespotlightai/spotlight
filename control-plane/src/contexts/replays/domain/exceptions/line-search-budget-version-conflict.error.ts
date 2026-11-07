import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export class LineSearchBudgetVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(lineId: LineId) {
    super(
      `The search budget of line ${lineId.value} changed since it was loaded. Please try again.`,
    );
    this.name = 'LineSearchBudgetVersionConflictError';
  }
}

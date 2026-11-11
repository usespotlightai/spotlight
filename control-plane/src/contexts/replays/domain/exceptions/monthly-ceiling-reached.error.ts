import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export class MonthlyCeilingReachedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(lineId: LineId) {
    super(
      `Line ${lineId.value} has no room left in the monthly ceiling of its search policy.`,
    );
    this.name = 'MonthlyCeilingReachedError';
  }
}

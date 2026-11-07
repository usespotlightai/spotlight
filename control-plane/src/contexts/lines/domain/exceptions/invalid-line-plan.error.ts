import type { PlanFlaw } from '@lines/domain/value-objects/plan-flaw';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidLinePlanError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    line: string,
    because: string,
    readonly flaw: PlanFlaw = { in: 'line', rule: null },
  ) {
    super(`Line ${line} ${because}.`);
    this.name = 'InvalidLinePlanError';
  }
}

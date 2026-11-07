import type { RoleClaimedTwice } from '@lines/domain/services/line-roles';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class LineRoleTakenError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly claim: RoleClaimedTwice) {
    super(
      `Line ${claim.line.value} cannot take role ${claim.role.value}. Another line already has it.`,
    );
    this.name = 'LineRoleTakenError';
  }
}

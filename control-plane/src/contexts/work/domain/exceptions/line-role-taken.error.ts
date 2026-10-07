import type { RoleClaimedTwice } from '@work/domain/services/line-roles';

export class LineRoleTakenError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly claim: RoleClaimedTwice) {
    super(
      `Line ${claim.line.value} cannot take role ${claim.role.value}. Another line already has it.`,
    );
    this.name = 'LineRoleTakenError';
  }
}

import type { RoleClaimedTwice } from '@work/domain/services/line-roles';

export class LineRoleTakenError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly claim: RoleClaimedTwice) {
    super(
      `The ${claim.line.value} line claims the role "${claim.role.value}", which another line already does`,
    );
    this.name = 'LineRoleTakenError';
  }
}

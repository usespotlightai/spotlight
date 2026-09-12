import { TEAM_ROLES } from '@domain/value-objects/team-role.vo';

export class InvalidTeamRoleError extends Error {
  readonly violation = 'invalid' as const;

  constructor(raw: string) {
    super(
      `There is no such role on a team as ${raw}. A person is one of: ${TEAM_ROLES.join(', ')}`,
    );
    this.name = 'InvalidTeamRoleError';
  }
}

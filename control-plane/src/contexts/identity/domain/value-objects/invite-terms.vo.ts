import type {
  WorkspaceRole,
  WorkspaceRoleName,
} from '@identity/domain/value-objects/workspace-role.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export type InvitableRoleName = Exclude<WorkspaceRoleName, 'owner'>;

export const invitable = (role: WorkspaceRoleName): InvitableRoleName => {
  if (role === 'owner') {
    throw new InconsistentStateError('invite', 'offers to make an owner');
  }

  return role;
};

export class InviteTerms {
  private constructor(
    readonly role: WorkspaceRole,
    readonly teams: readonly TeamId[],
  ) {}

  static of(role: WorkspaceRole, teams: readonly TeamId[]): InviteTerms {
    invitable(role.value);

    return new InviteTerms(
      role,
      teams.filter(
        (team, at) => teams.findIndex((each) => each.equals(team)) === at,
      ),
    );
  }

  get invitedAs(): InvitableRoleName {
    return invitable(this.role.value);
  }

  joins(teamId: TeamId): boolean {
    return this.teams.some((each) => each.equals(teamId));
  }
}

import { InvalidTeamRoleError } from '@domain/exceptions/invalid-team-role.error';

export const TEAM_ROLES = ['owner', 'member'] as const;

export type TeamRoleName = (typeof TEAM_ROLES)[number];

export class TeamRole {
  static readonly owner = new TeamRole('owner');
  static readonly member = new TeamRole('member');

  private constructor(readonly value: TeamRoleName) {}

  static get all(): readonly TeamRole[] {
    return [TeamRole.owner, TeamRole.member];
  }

  static of(raw: string): TeamRole {
    const named = raw.trim().toLowerCase();
    const known = TeamRole.all.find((role) => role.value === named);

    if (!known) {
      throw new InvalidTeamRoleError(raw.trim());
    }

    return known;
  }

  get isOwner(): boolean {
    return this.value === 'owner';
  }

  equals(other: TeamRole): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

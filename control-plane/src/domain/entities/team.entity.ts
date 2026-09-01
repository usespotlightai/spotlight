import { TeamId } from '@domain/value-objects/team-id.vo';
import type { TeamName } from '@domain/value-objects/team-name.vo';
import type { TeamRole } from '@domain/value-objects/team-role';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface TeamMember {
  readonly userId: UserId;
  readonly role: TeamRole;
}

export class Team {
  private constructor(
    readonly id: TeamId,
    readonly name: TeamName,
    readonly members: readonly TeamMember[],
  ) {}

  static create(input: {
    name: TeamName;
    owner: UserId;
    newId: () => string;
  }): Team {
    return new Team(TeamId.of(input.newId()), input.name, [
      { userId: input.owner, role: 'owner' },
    ]);
  }

  static rehydrate(input: {
    id: TeamId;
    name: TeamName;
    members: readonly TeamMember[];
  }): Team {
    return new Team(input.id, input.name, input.members);
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }
}

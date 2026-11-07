import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TeamMembers {
  private constructor(private readonly members: readonly UserId[]) {}

  static of(members: readonly UserId[]): TeamMembers {
    return new TeamMembers([...members]);
  }

  includes(person: UserId): boolean {
    return this.members.some((each) => each.equals(person));
  }

  equals(other: TeamMembers): boolean {
    return (
      this.members.length === other.members.length &&
      this.members.every((each) => other.includes(each))
    );
  }
}

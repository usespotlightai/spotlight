import { Factory } from '@domain/entities/factory.entity';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
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
    readonly factory: Factory,
  ) {}

  static create(input: {
    id: TeamId;
    name: TeamName;
    owner: UserId;
    factoryId: FactoryId;
  }): Team {
    return new Team(
      input.id,
      input.name,
      [{ userId: input.owner, role: 'owner' }],
      Factory.create({ id: input.factoryId }),
    );
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }
}

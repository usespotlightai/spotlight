import type { Membership } from '@memory/domain/services/team-access';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const PEOPLE = Symbol('PEOPLE');

export interface Person {
  readonly name: string | null;
  readonly image: string | null;
}

export interface PeoplePort {
  memberOf(teamId: string, userId: string): Promise<Membership | null>;

  find(userId: UserId): Promise<Person | null>;
}

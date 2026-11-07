import type { TeamViewer } from '@memory/domain/services/team-access';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const PEOPLE = Symbol('PEOPLE');

export interface Person {
  readonly name: string | null;
  readonly image: string | null;
}

export interface PeoplePort {
  viewerOf(teamId: string, userId: string): Promise<TeamViewer | null>;

  find(userId: UserId): Promise<Person | null>;
}

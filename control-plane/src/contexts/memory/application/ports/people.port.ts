import type { TeamViewer } from '@memory/domain/services/team-access';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const PEOPLE = Symbol('PEOPLE');

export interface Person {
  readonly name: string | null;
  readonly image: string | null;
}

export interface PeoplePort {
  viewerOf(teamId: TeamId, userId: UserId): Promise<TeamViewer | null>;

  find(userId: UserId): Promise<Person | null>;
}

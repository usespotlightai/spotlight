import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PEOPLE = Symbol('PEOPLE');

export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export interface Person {
  readonly name: string | null;
  readonly image: string | null;
}

export interface PeoplePort {
  memberOf(teamId: string, userId: string): Promise<Membership | null>;

  find(userId: UserId): Promise<Person | null>;
}

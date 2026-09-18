import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PEOPLE = Symbol('PEOPLE');

export interface Person {
  readonly name: string;
  readonly image: string | null;
}

export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export interface PeoplePort {
  find(userId: UserId): Promise<Person | null>;

  pictureOf(login: string): string | null;

  memberOf(teamId: string, userId: string): Promise<Membership | null>;
}

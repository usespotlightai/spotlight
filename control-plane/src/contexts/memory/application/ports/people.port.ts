import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PEOPLE = Symbol('PEOPLE');

export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export interface PeoplePort {
  memberOf(teamId: string, userId: string): Promise<Membership | null>;

  nameOf(userId: UserId): Promise<string | null>;
}

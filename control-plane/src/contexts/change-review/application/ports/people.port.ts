import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PEOPLE = Symbol('PEOPLE');

export interface Person {
  readonly name: string;
  readonly image: string | null;
}

export interface TeamViewer {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly by: UserId;
}

export interface PeoplePort {
  find(userId: UserId): Promise<Person | null>;

  viewerOf(teamId: TeamId, userId: UserId): Promise<TeamViewer | null>;
}

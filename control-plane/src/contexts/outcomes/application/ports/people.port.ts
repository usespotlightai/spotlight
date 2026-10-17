import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PEOPLE = Symbol('OUTCOMES_PEOPLE');

export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export interface PeoplePort {
  membershipOnTeam(
    teamId: string,
    principal: Principal,
  ): Promise<Membership | null>;

  namesOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

import type { TeamViewer } from '@insights/domain/value-objects/viewed-team.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const PEOPLE = Symbol('INSIGHTS_PEOPLE');

export interface PeoplePort {
  viewerOf(teamId: TeamId, principal: Principal): Promise<TeamViewer | null>;

  namesOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

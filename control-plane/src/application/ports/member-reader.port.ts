import type { PersonSummary } from '@application/ports/person-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export const MEMBER_READER = Symbol('MEMBER_READER');

export interface MemberReaderPort {
  /** The team's members, or null where the viewer is not one to see them. */
  listForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<PersonSummary[] | null>;
}

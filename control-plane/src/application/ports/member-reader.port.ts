import type { PersonSummary } from '@application/ports/person-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export const MEMBER_READER = Symbol('MEMBER_READER');

export interface MemberReaderPort {
  /** The team's members, or null where the viewer is not one to see them. */
  listForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<PersonSummary[] | null>;

  /**
   * A member of the workspace by their email, case-insensitively, or null where
   * none has it. Asked without a viewer: it is Spotlight matching an outside
   * name to a person, not a person reading the roster.
   */
  byEmail(workspaceId: WorkspaceId, email: string): Promise<UserId | null>;
}

import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamMember {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export interface ReviewedWork {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
}

export class TeamAccess {
  private constructor(
    private readonly workspaceId: WorkspaceId,
    private readonly teamId: TeamId,
  ) {}

  static of(member: TeamMember): TeamAccess {
    return new TeamAccess(member.workspaceId, member.teamId);
  }

  allows(work: ReviewedWork): boolean {
    return (
      work.workspaceId.equals(this.workspaceId) &&
      (work.teamId?.equals(this.teamId) ?? false)
    );
  }
}

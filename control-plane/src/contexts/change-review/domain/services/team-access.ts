import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ViewedTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export interface ReviewedWork {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
}

export interface TasklessRun {
  readonly workspaceId: WorkspaceId;
  readonly isReplay: boolean;
  readonly isSearch: boolean;
}

export class TeamAccess {
  private constructor(
    private readonly workspaceId: WorkspaceId,
    private readonly teamId: TeamId,
  ) {}

  static of(team: ViewedTeam): TeamAccess {
    return new TeamAccess(team.workspaceId, team.teamId);
  }

  allows(work: ReviewedWork): boolean {
    return (
      work.workspaceId.equals(this.workspaceId) &&
      (work.teamId?.equals(this.teamId) ?? false)
    );
  }

  allowsTasklessRun(run: TasklessRun, ranFor: TeamId | null): boolean {
    return (
      (run.isReplay || run.isSearch) &&
      this.allows({ workspaceId: run.workspaceId, teamId: ranFor })
    );
  }
}

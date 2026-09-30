import { NotOnTeamError } from '@outcomes/domain/exceptions/not-on-team.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamStanding {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export class OutcomesClearance {
  private constructor(
    readonly teamId: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly by: UserId,
  ) {}

  static onTeam(
    teamId: string,
    standing: TeamStanding | null,
  ): OutcomesClearance {
    if (!standing) {
      throw new NotOnTeamError(teamId);
    }

    return new OutcomesClearance(
      TeamId.of(teamId),
      standing.workspaceId,
      standing.by,
    );
  }
}

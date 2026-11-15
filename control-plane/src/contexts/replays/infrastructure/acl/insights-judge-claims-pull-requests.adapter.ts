import type {
  JudgeClaimsPullRequest,
  JudgeClaimsPullRequestsPort,
} from '@insights/application/ports/judge-claims-pull-requests.port';
import type { RequestJudgeClaimsPullRequests } from '@replays/application/services/request-judge-claims-pull-requests.service';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class InsightsJudgeClaimsPullRequests implements JudgeClaimsPullRequestsPort {
  constructor(private readonly requesting: RequestJudgeClaimsPullRequests) {}

  request(request: JudgeClaimsPullRequest): Promise<void> {
    return this.requesting.request({
      revisionId: request.revisionId,
      station: {
        workspaceId: WorkspaceId.of(request.workspaceId),
        teamId: TeamId.of(request.teamId),
        lineId: LineId.of(request.lineId),
        stationId: StationId.of(request.stationId),
      },
      proposal: {
        trigger: request.trigger,
        claimsBefore: request.claimsBefore,
        claimsAfter: request.claimsAfter,
        searched: request.searched,
        heldOut: request.heldOut,
        disagreementRuns: request.disagreementRuns,
      },
    });
  }
}

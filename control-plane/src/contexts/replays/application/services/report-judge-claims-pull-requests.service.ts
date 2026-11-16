import type { ClaimsRevisionsPort } from '@replays/application/ports/claims-revisions.port';
import type { JudgeClaimsPullRequestFailed } from '@replays/domain/events/judge-claims-pull-request-failed.event';
import type { JudgeClaimsPullRequestOpened } from '@replays/domain/events/judge-claims-pull-request-opened.event';

export class ReportJudgeClaimsPullRequests {
  constructor(private readonly revisions: ClaimsRevisionsPort) {}

  ended(
    event: JudgeClaimsPullRequestOpened | JudgeClaimsPullRequestFailed,
  ): Promise<void> {
    return event.kind === 'judge-claims-pull-request.opened'
      ? this.revisions.pullRequestOpened(event.revisionId, event.url)
      : this.revisions.pullRequestFailed(event.revisionId, event.reason);
  }
}

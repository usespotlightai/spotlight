import type { ClaimsRevisionPullRequestsPort } from '@insights/application/ports/claims-revision-pull-requests.port';
import type { ClaimsRevisionsPort } from '@replays/application/ports/claims-revisions.port';

export class InsightsClaimsRevisions implements ClaimsRevisionsPort {
  constructor(private readonly revisions: ClaimsRevisionPullRequestsPort) {}

  pullRequestOpened(revisionId: string, url: string): Promise<void> {
    return this.revisions.opened({ revisionId, url });
  }

  pullRequestFailed(revisionId: string, reason: string): Promise<void> {
    return this.revisions.failed({ revisionId, reason });
  }
}

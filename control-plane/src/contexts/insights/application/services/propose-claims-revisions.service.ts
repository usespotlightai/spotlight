import type { ClaimsRevisionPullRequestsPort } from '@insights/application/ports/claims-revision-pull-requests.port';
import type {
  DisagreementRun,
  DisagreementRunNote,
  JudgeClaimsPullRequestsPort,
} from '@insights/application/ports/judge-claims-pull-requests.port';
import type { ClaimsRevision } from '@insights/domain/aggregates/claims-revision.aggregate';
import type { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import type { ClaimsRevisionPicked } from '@insights/domain/events/claims-revision-picked.event';
import type { ClaimsRevisionRepository } from '@insights/domain/repositories/claims-revision.repository';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

const notesOf = (disagreement: JudgeDisagreement): DisagreementRunNote[] => {
  const { notMet } = disagreement;
  const answered = disagreement.claimAnswers.flatMap((each) =>
    nonEmpty(each.note) ? [{ claim: each.claim, text: each.note }] : [],
  );

  return notMet !== null && notMet.note !== null && notMet.note !== ''
    ? [...answered, { claim: notMet.shouldHaveFailed, text: notMet.note }]
    : answered;
};

const disagreementRunOf = (
  disagreement: JudgeDisagreement,
): DisagreementRun[] =>
  disagreement.state === 'answered'
    ? [
        {
          runId: disagreement.runId.value,
          taskId: disagreement.location.taskId.value,
          direction: disagreement.direction,
          claimsWrong: disagreement.claimsWrong,
          notes: notesOf(disagreement),
        },
      ]
    : [];

export class ProposeClaimsRevisions implements ClaimsRevisionPullRequestsPort {
  constructor(
    private readonly revisions: ClaimsRevisionRepository,
    private readonly disagreements: JudgeDisagreementRepository,
    private readonly pullRequests: JudgeClaimsPullRequestsPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async picked(event: ClaimsRevisionPicked): Promise<void> {
    const revision = await this.revisions.find(event.revisionId);
    const pick = revision?.awaitsPullRequest ? revision.pick : null;

    if (!revision || !pick) {
      return;
    }

    const { station, rubric } = revision;
    const answered = await this.disagreements.answeredAt({
      stationId: station.stationId,
      rubricVersion: rubric.version,
      since: null,
    });

    await this.pullRequests.request({
      workspaceId: station.workspaceId.value,
      teamId: station.teamId.value,
      lineId: station.lineId.value,
      stationId: station.stationId.value,
      revisionId: revision.id.value,
      trigger: revision.trigger,
      claimsBefore: rubric.claims,
      claimsAfter: pick.claims,
      searched: pick.agreement.searched,
      heldOut: pick.agreement.heldOut,
      disagreementRuns: answered.flatMap(disagreementRunOf),
    });
  }

  opened(event: { revisionId: string; url: string }): Promise<void> {
    return this.finished(event.revisionId, (revision, now) =>
      revision.proposed({ pullRequest: event.url, now }),
    );
  }

  failed(event: { revisionId: string; reason: string }): Promise<void> {
    return this.finished(event.revisionId, (revision, now) =>
      revision.pullRequestFailed({ message: event.reason, now }),
    );
  }

  private finished(
    revisionId: string,
    change: (revision: ClaimsRevision, now: Date) => ClaimsRevision,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const revision = await this.revisions.find(
        ClaimsRevisionId.of(revisionId),
      );
      const next = revision ? change(revision, this.clock.now()) : null;

      if (revision && next && next !== revision) {
        await this.revisions.save(next);
      }
    });
  }
}

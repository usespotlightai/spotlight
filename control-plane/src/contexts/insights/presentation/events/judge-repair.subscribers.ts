import type { BackfillJudgings } from '@insights/application/services/backfill-judgings.service';
import type { ClaimsSources } from '@insights/application/services/claims-sources.service';
import type { JudgeDisagreementInbox } from '@insights/application/services/judge-disagreement-inbox.service';
import type { ProposeClaimsRevisions } from '@insights/application/services/propose-claims-revisions.service';
import type { RaiseJudgeDisagreements } from '@insights/application/services/raise-judge-disagreements.service';
import type { StartClaimsRevisions } from '@insights/application/services/start-claims-revisions.service';
import type { ClaimsRevisionPicked } from '@insights/domain/events/claims-revision-picked.event';
import type { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
import type { JudgeDisagreementOpened } from '@insights/domain/events/judge-disagreement-opened.event';
import type { JudgeDisagreementWithdrawn } from '@insights/domain/events/judge-disagreement-withdrawn.event';
import type { PullRequestRecordClosed } from '@insights/domain/events/pull-request-record-closed.event';
import type { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import type { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

export interface JudgeRepairHandlers {
  readonly disagreeing: RaiseJudgeDisagreements;
  readonly questioning: JudgeDisagreementInbox;
  readonly revising: StartClaimsRevisions;
  readonly proposing: ProposeClaimsRevisions;
  readonly backfilling: BackfillJudgings;
  readonly sourcing: ClaimsSources;
}

type DisagreementMoved = JudgeDisagreementOpened | JudgeDisagreementAnswered;

const DISAGREEMENT_MOVED = [
  'judge-disagreement.opened',
  'judge-disagreement.answered',
];

type InboxRequestMoved = DisagreementMoved | JudgeDisagreementWithdrawn;

const INBOX_REQUEST_MOVED = [
  ...DISAGREEMENT_MOVED,
  'judge-disagreement.withdrawn',
];

export const judgeRepairSubscribers = (
  handlers: JudgeRepairHandlers,
): readonly DomainEventSubscriber[] => [
  subscribing<ScoreRecorded>(
    'insights.disagree-with-judge-after-score',
    ['score.recorded'],
    (event) => handlers.disagreeing.scoreRecorded(event),
    { callsOut: true },
  ),
  subscribing<RunRecordEnded>(
    'insights.disagree-with-judge-after-run-ended',
    ['run-record.ended'],
    (event) => handlers.disagreeing.runEnded(event),
    { callsOut: true },
  ),
  subscribing<RunOutcomeChanged>(
    'insights.disagree-with-judge-after-run-outcome-changed',
    ['run-record.outcome-changed'],
    (event) => handlers.disagreeing.outcomeChanged(event),
    { callsOut: true },
  ),
  subscribing<PullRequestRecordClosed>(
    'insights.disagree-with-judge-after-closed-pull-request',
    ['pull-request-record.closed'],
    (event) => handlers.disagreeing.pullRequestClosed(event),
    { callsOut: true },
  ),
  subscribing<InboxRequestMoved>(
    'insights.follow-judge-disagreement-inbox-request',
    INBOX_REQUEST_MOVED,
    (event) => handlers.questioning.moved(event),
  ),
  subscribing<DisagreementMoved>(
    'insights.revise-claims-after-disagreement',
    DISAGREEMENT_MOVED,
    (event) => handlers.revising.disagreed(event),
  ),
  subscribing<ClaimsRevisionPicked>(
    'insights.propose-picked-claims-revision',
    ['claims-revision.picked'],
    (event) => handlers.proposing.picked(event),
    { callsOut: true },
  ),
  subscribing<LineChangedIntegrationEvent>(
    'insights.withdraw-judge-disagreements-after-line-changed',
    [LINE_CHANGED],
    (event) => handlers.disagreeing.lineChanged(event),
    { callsOut: true },
  ),
  subscribing<LineChangedIntegrationEvent>(
    'insights.rejudge-labelled-runs-after-line-changed',
    [LINE_CHANGED],
    (event) => handlers.backfilling.lineChanged(event),
    { callsOut: true },
  ),
  subscribing<LineChangedIntegrationEvent>(
    'insights.record-claims-source-after-line-changed',
    [LINE_CHANGED],
    (event) => handlers.sourcing.lineChanged(event),
    { callsOut: true },
  ),
];

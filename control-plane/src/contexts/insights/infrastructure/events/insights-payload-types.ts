import { PullRequestOwned } from '@insights/domain/events/pull-request-owned.event';
import { PullRequestRecordClosed } from '@insights/domain/events/pull-request-record-closed.event';
import { PullRequestRecordErased } from '@insights/domain/events/pull-request-record-erased.event';
import { PullRequestReleased } from '@insights/domain/events/pull-request-released.event';
import { PullRequestReviewTaskAdded } from '@insights/domain/events/pull-request-review-task-added.event';
import { PullRequestSeen } from '@insights/domain/events/pull-request-seen.event';
import { RunDismissalRecorded } from '@insights/domain/events/run-dismissal-recorded.event';
import { RunJudged } from '@insights/domain/events/run-judged.event';
import { RunMemoriesRecorded } from '@insights/domain/events/run-memories-recorded.event';
import { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { RunRecordErased } from '@insights/domain/events/run-record-erased.event';
import { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import { StationAlertReopened } from '@insights/domain/events/station-alert-reopened.event';
import { StationAlertResolved } from '@insights/domain/events/station-alert-resolved.event';
import { TaskChangeShapeErased } from '@insights/domain/events/task-change-shape-erased.event';
import { TaskChangeShaped } from '@insights/domain/events/task-change-shaped.event';
import { TaskHumanActionsErased } from '@insights/domain/events/task-human-actions-erased.event';
import { TaskOpeningRecorded } from '@insights/domain/events/task-opening-recorded.event';
import { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { PairReason } from '@insights/domain/value-objects/pair-reason.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { RunMemories } from '@insights/domain/value-objects/run-memories.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { SeenPullRequest } from '@insights/domain/value-objects/seen-pull-request.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { Tombstones } from '@insights/domain/value-objects/tombstones.vo';
import { TraceRange } from '@insights/domain/value-objects/trace-range.vo';
import { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
export const INSIGHTS_PAYLOAD_TYPES = [
  TraceRange,
  FactOwner,
  Tombstones,
  FailureOccurrence,
  StationPass,
  InboxAsk,
  InsightsPeriod,
  TaskHumanAction,
  RunAgentConfig,
  TaskOpening,
  ViewedTeam,
  HumanAction,
  RunUsage,
  RunEnd,
  RunFact,
  RunLocation,
  RunTools,
  RunMemories,
  Dismissal,
  Citation,
  JudgeReason,
  Rubric,
  ScoreId,
  ScoreFact,
  ScoreScale,
  PairReason,
  SeenEvidence,
  SeenPullRequest,
  RunJudged,
  ScoreRecorded,
  RunRecordEnded,
  RunOutcomeChanged,
  RunMemoriesRecorded,
  RunDismissalRecorded,
  RunRecordErased,
  TaskOpeningRecorded,
  TaskHumanActionsErased,
  TaskChangeShaped,
  TaskChangeShapeErased,
  PullRequestSeen,
  PullRequestOwned,
  PullRequestReviewTaskAdded,
  PullRequestReleased,
  PullRequestRecordErased,
  PullRequestRecordClosed,
  AlertId,
  AlertRule,
  AlertFiring,
  StationAlertFired,
  StationAlertResolved,
  StationAlertReopened,
] as const;

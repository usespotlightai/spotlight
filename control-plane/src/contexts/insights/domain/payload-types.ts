import { ChangeJudged } from '@insights/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@insights/domain/events/change-judging-failed.event';
import { RunJudged } from '@insights/domain/events/run-judged.event';
import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { RunRecordEnriched } from '@insights/domain/events/run-record-enriched.event';
import { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { SideBySideJudged } from '@insights/domain/events/side-by-side-judged.event';
import { SideBySideJudgingFailed } from '@insights/domain/events/side-by-side-judging-failed.event';
import { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import { StationAlertReopened } from '@insights/domain/events/station-alert-reopened.event';
import { StationAlertResolved } from '@insights/domain/events/station-alert-resolved.event';
import { TaskPullRequestClosed } from '@insights/domain/events/task-pull-request-closed.event';
import { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import { PairReason } from '@insights/domain/value-objects/pair-reason.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { RunMemories } from '@insights/domain/value-objects/run-memories.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { TraceRange } from '@insights/domain/value-objects/trace-range.vo';
export const INSIGHTS_PAYLOAD_TYPES = [
  TraceRange,
  FailureOccurrence,
  StationPass,
  InboxAsk,
  InsightsPeriod,
  TaskHumanAction,
  RunAgentConfig,
  TaskOpening,
  HumanAction,
  RunUsage,
  RunEnd,
  RunLocation,
  RunTools,
  RunMemories,
  Dismissal,
  Citation,
  JudgeReason,
  JudgingFailure,
  Rubric,
  ScoreId,
  ScoreScale,
  SeenEvidence,
  RunJudged,
  ChangeJudged,
  ChangeJudgingFailed,
  SideBySideJudged,
  SideBySideJudgingFailed,
  PairReason,
  JudgeCriteria,
  ScoreRecorded,
  RunRecordEnded,
  RunRecordEnriched,
  TaskPullRequestClosed,
  AlertId,
  AlertRule,
  AlertFiring,
  StationAlertFired,
  StationAlertResolved,
  StationAlertReopened,
] as const;

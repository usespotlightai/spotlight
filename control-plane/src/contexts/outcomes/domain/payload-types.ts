import { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@outcomes/domain/events/change-judging-failed.event';
import { PairJudged } from '@outcomes/domain/events/pair-judged.event';
import { PairJudgingFailed } from '@outcomes/domain/events/pair-judging-failed.event';
import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import { RunRecordEnriched } from '@outcomes/domain/events/run-record-enriched.event';
import { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import { StationAlertRaised } from '@outcomes/domain/events/station-alert-raised.event';
import { StationAlertRecovered } from '@outcomes/domain/events/station-alert-recovered.event';
import { StationAlertReopened } from '@outcomes/domain/events/station-alert-reopened.event';
import { TaskDeliveryClosed } from '@outcomes/domain/events/task-delivery-closed.event';
import { AlertCrossing } from '@outcomes/domain/value-objects/alert-crossing.vo';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { PairReason } from '@outcomes/domain/value-objects/pair-reason.vo';
import { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import { Refusal } from '@outcomes/domain/value-objects/refusal.vo';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunMemories } from '@outcomes/domain/value-objects/run-memories.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { StationPass } from '@outcomes/domain/value-objects/station-pass.vo';
import { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';
export const OUTCOMES_PAYLOAD_TYPES = [
  FailureOccurrence,
  StationPass,
  InboxAsk,
  InsightsPeriod,
  PersonTouch,
  RunSetup,
  TaskOpening,
  NextAct,
  RunCost,
  RunEnd,
  RunPlace,
  RunTools,
  RunMemories,
  Refusal,
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
  PairJudged,
  PairJudgingFailed,
  PairReason,
  JudgeCriteria,
  ScoreRecorded,
  RunRecordEnded,
  RunRecordEnriched,
  TaskDeliveryClosed,
  AlertId,
  AlertRule,
  AlertCrossing,
  StationAlertRaised,
  StationAlertRecovered,
  StationAlertReopened,
] as const;

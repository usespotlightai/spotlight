import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import { HandedOn } from '@outcomes/domain/value-objects/handed-on.vo';
import { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';

export const OUTCOMES_EVENT_TYPES = [
  FailureOccurrence,
  HandedOn,
  InboxAsk,
  InsightsPeriod,
  PersonTouch,
  RunSetup,
  TaskOpening,
  NextAct,
  RunCost,
  RunEnd,
  RunPlace,
  Citation,
  JudgeReason,
  JudgingFailure,
  Rubric,
  ScoreId,
  ScoreScale,
  SeenEvidence,
  RunJudged,
  ScoreRecorded,
] as const;

import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';

export const OUTCOMES_EVENT_TYPES = [
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

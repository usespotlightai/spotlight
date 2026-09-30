import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';

export const OUTCOMES_EVENT_TYPES = [
  NextAct,
  RunCost,
  RunEnd,
  RunPlace,
] as const;

import type { LeftOutCause } from '@insights/domain/value-objects/left-out-cause';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';

export interface EndingToClassify {
  readonly ending: RunEnding;
  readonly failure: string | null;
}

export interface RunEndingsPort {
  /** Why a run that ended so ended outside its station's work, as Runs classifies it; null when it ended in that work. */
  outsideCauseOf(end: EndingToClassify): LeftOutCause | null;
}

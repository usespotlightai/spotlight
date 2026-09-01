import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';

export const RUN_OUTCOMES = Symbol('RUN_OUTCOMES');

export interface RunOutcomes {
  onRunCompleted(event: RunCompleted): Promise<void>;
  onRunAbandoned(event: RunAbandoned): Promise<void>;
}

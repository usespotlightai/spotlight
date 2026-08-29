import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';

export const HANDOVER = Symbol('HANDOVER');

/** Moves a task on once the run working it has ended. */
export interface HandoverPort {
  onRunCompleted(event: RunCompleted): Promise<void>;
  onRunAbandoned(event: RunAbandoned): Promise<void>;
}

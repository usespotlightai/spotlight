import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';

export interface RunOutcomes {
  onRunCompleted(event: RunCompleted): Promise<void>;
  onRunAbandoned(event: RunAbandoned): Promise<void>;
}

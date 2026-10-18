import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';

export interface RunOutcomes {
  onRunCompleted(event: RunCompleted): Promise<void>;
  onRunExhausted(event: RunExhausted): Promise<void>;
}

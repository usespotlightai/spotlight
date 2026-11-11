import type { RunEnded } from '@insights/application/services/record-run-ending.service';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type {
  DispatchEndedIntegrationEvent,
  DispatchOutcomePublished as RunEndedOutcome,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';

const ENDING_OF: Readonly<Record<RunEndedOutcome, RunEnding>> = {
  completed: 'completed',
  failed: 'failed',
  exhausted: 'exhausted',
  cancelled: 'cancelled',
};

export const endingOf = (
  event: Pick<DispatchEndedIntegrationEvent, 'outcome' | 'stopped' | 'failure'>,
): RunEnding | null => {
  const outcome: RunEnding | undefined = ENDING_OF[event.outcome];

  if (!outcome) {
    return null;
  }
  if (event.failure === 'superseded' && outcome !== 'cancelled') {
    return 'superseded';
  }
  if (event.stopped && outcome === 'completed') {
    return 'stopped';
  }

  return outcome;
};

export const runEndedOf = (event: DispatchEndedIntegrationEvent): RunEnded => ({
  runId: event.runId,
  taskId: event.taskId,
  stationId: event.stationId,
  ending: endingOf(event),
  failure: event.failure,
  asked: event.asked,
});

import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import type { RecordRunUsage } from '@work/application/events/handlers/record-run-usage.handler';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';

export const runUsageSubscribers = (
  usages: RecordRunUsage,
): readonly DomainEventSubscriber[] => [
  subscribing<RunCompleted>(
    'work.record-run-usage.completed',
    ['run.completed'],
    (event) => usages.onRunCompleted(event),
  ),
  subscribing<RunExhausted>(
    'work.record-run-usage.exhausted',
    ['run.exhausted'],
    (event) => usages.onRunExhausted(event),
  ),
];

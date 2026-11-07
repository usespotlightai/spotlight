export { RunFacts } from '@runs/application/services/run-facts.service';
export { Runs } from '@runs/application/services/runs.service';
export { InMemoryArchives } from '@runs/application/services/workspace-archives.fake-spec';
export { Run } from '@runs/domain/aggregates/run.aggregate';
export { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
export { RunCancelled } from '@runs/domain/events/run-cancelled.event';
export { RunCompleted } from '@runs/domain/events/run-completed.event';
export { RunExhausted } from '@runs/domain/events/run-exhausted.event';
export { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
export type { RunRepository } from '@runs/domain/repositories/run.repository';
export type { WorkspaceArchiveRepository } from '@runs/domain/repositories/workspace-archive.repository';
export { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
export { HarnessCommand } from '@runs/domain/value-objects/harness-command.vo';
export { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
export { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
export { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
export { RunSpec } from '@runs/domain/value-objects/run-spec.vo';

import { RUNS_EVENT_MAPPERS } from '@runs/application/integration-events/runs.event-mappers';
import type { RequestedRunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/requested-run-ended.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export const publishedAs = <T>(
  event: DomainEvent,
  at = new Date('2026-10-02T09:30:00.000Z'),
): T => {
  const mapper = RUNS_EVENT_MAPPERS.find((each) => each.from === event.kind);
  const mapped = mapper?.map(event, at);

  if (!mapped) {
    throw new Error(`Runs publishes nothing for ${event.kind}`);
  }

  return mapped as T;
};

export const runEndedOf = (
  event: DomainEvent,
  at?: Date,
): RequestedRunEndedIntegrationEvent =>
  publishedAs<RequestedRunEndedIntegrationEvent>(event, at);
export { CompleteRunHandler } from '@runs/application/commands/handlers/complete-run.handler';
export { CompleteRunCommand } from '@runs/application/commands/runner.commands';
export { Handover as RunHandover } from '@runs/domain/value-objects/handover.vo';
export { RunConnection } from '@runs/domain/value-objects/run-connection.vo';

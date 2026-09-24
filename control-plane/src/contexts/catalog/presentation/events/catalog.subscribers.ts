import type { CallMeterPort } from '@catalog/application/ports/call-meter.port';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import {
  WORKSPACE_CLOSED,
  type WorkspaceClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const catalogSubscribers = (reactions: {
  plans: WorkspacePlanRepository;
  meter: CallMeterPort;
}): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceClosedIntegrationEvent>(
    'catalog.forget-plan-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) => reactions.plans.forget(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'catalog.forget-calls-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) => reactions.meter.forget(WorkspaceId.of(event.workspaceId)),
  ),
];

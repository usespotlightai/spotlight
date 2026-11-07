import type { HostBecameReady } from '@runners/domain/events/host-became-ready.event';
import type { RunnerPoolCreated } from '@runners/domain/events/runner-pool-created.event';
import type { RunnerTrustCreated } from '@runners/domain/events/runner-trust-created.event';
import {
  HOST_BECAME_READY,
  type HostBecameReadyIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-became-ready.integration-event';
import {
  RUNNER_ACCESS_CREATED,
  type RunnerAccessCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-access-created.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const RUNNERS_EVENT_MAPPERS = [
  mapping<RunnerPoolCreated>(
    'runner-pool.created',
    (event): RunnerAccessCreatedIntegrationEvent => ({
      kind: RUNNER_ACCESS_CREATED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<RunnerTrustCreated>(
    'runner-trust.created',
    (event): RunnerAccessCreatedIntegrationEvent => ({
      kind: RUNNER_ACCESS_CREATED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<HostBecameReady>(
    'runner-host.became-ready',
    (event): HostBecameReadyIntegrationEvent => ({
      kind: HOST_BECAME_READY,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;

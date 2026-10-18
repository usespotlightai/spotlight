import type { HostReady } from '@runners/domain/events/host-ready.event';
import type { RunnerPoolCreated } from '@runners/domain/events/runner-pool-created.event';
import type { RunnerTrustCreated } from '@runners/domain/events/runner-trust-created.event';
import {
  HOST_READY,
  type HostReadyIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-ready.integration-event';
import {
  RUNNER_ACCESS_DEFINED,
  type RunnerAccessDefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-access-defined.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const RUNNERS_EVENT_MAPPERS = [
  mapping<RunnerPoolCreated>(
    'runner-pool.created',
    (event): RunnerAccessDefinedIntegrationEvent => ({
      kind: RUNNER_ACCESS_DEFINED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<RunnerTrustCreated>(
    'runner-trust.created',
    (event): RunnerAccessDefinedIntegrationEvent => ({
      kind: RUNNER_ACCESS_DEFINED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<HostReady>(
    'runner-host.ready',
    (event): HostReadyIntegrationEvent => ({
      kind: HOST_READY,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;

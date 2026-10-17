import type { RunnerHostStartedServing } from '@runners/domain/events/runner-host-started-serving.event';
import type { RunnerPoolCreated } from '@runners/domain/events/runner-pool-created.event';
import type { RunnerTrustCreated } from '@runners/domain/events/runner-trust-created.event';
import {
  RUNNER_HOST_STARTED_SERVING,
  type RunnerHostStartedServingIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-host-started-serving.integration-event';
import {
  RUNNER_WAY_IN_OPENED,
  type RunnerWayInOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-way-in-opened.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const RUNNERS_EVENT_MAPPERS = [
  mapping<RunnerPoolCreated>(
    'runner-pool.created',
    (event): RunnerWayInOpenedIntegrationEvent => ({
      kind: RUNNER_WAY_IN_OPENED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<RunnerTrustCreated>(
    'runner-trust.created',
    (event): RunnerWayInOpenedIntegrationEvent => ({
      kind: RUNNER_WAY_IN_OPENED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<RunnerHostStartedServing>(
    'runner-host.started-serving',
    (event): RunnerHostStartedServingIntegrationEvent => ({
      kind: RUNNER_HOST_STARTED_SERVING,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;

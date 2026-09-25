import type { RunnerPoolDefined } from '@runners/domain/events/runner-pool-defined.event';
import type { RunnerTrustDefined } from '@runners/domain/events/runner-trust-defined.event';
import {
  RUNNER_WAY_IN_OPENED,
  type RunnerWayInOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-way-in-opened.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const RUNNERS_PUBLICATIONS = [
  publishing<RunnerPoolDefined>(
    'runner-pool.defined',
    (event): RunnerWayInOpenedIntegrationEvent => ({
      kind: RUNNER_WAY_IN_OPENED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  publishing<RunnerTrustDefined>(
    'runner-trust.defined',
    (event): RunnerWayInOpenedIntegrationEvent => ({
      kind: RUNNER_WAY_IN_OPENED,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;

import type { RunnerRegistered } from '@runners/domain/events/runner-registered.event';
import type { RunnerRevoked } from '@runners/domain/events/runner-revoked.event';
import {
  RUNNER_REGISTERED,
  type RunnerRegisteredIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-registered.integration-event';
import {
  RUNNER_REVOKED,
  type RunnerRevokedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-revoked.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const RUNNERS_PUBLICATIONS = [
  publishing<RunnerRegistered>(
    'runner.registered',
    (event): RunnerRegisteredIntegrationEvent => ({
      kind: RUNNER_REGISTERED,
      runnerId: event.runnerId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
  publishing<RunnerRevoked>(
    'runner.revoked',
    (event): RunnerRevokedIntegrationEvent => ({
      kind: RUNNER_REVOKED,
      runnerId: event.runnerId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;

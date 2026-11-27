import type { HostBecameReady } from '@runners/domain/events/host-became-ready.event';
import type { HostOutageBegan } from '@runners/domain/events/host-outage-began.event';
import type { HostOutageEnded } from '@runners/domain/events/host-outage-ended.event';
import type { RunnerEnded } from '@runners/domain/events/runner-ended.event';
import type { RunnerPoolCreated } from '@runners/domain/events/runner-pool-created.event';
import type { RunnerTrustCreated } from '@runners/domain/events/runner-trust-created.event';
import {
  HOST_BECAME_READY,
  type HostBecameReadyIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-became-ready.integration-event';
import {
  HOST_OUTAGE_BEGAN,
  type HostOutageBeganIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import {
  HOST_OUTAGE_ENDED,
  type HostOutageEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import {
  RUNNER_ACCESS_CREATED,
  type RunnerAccessCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-access-created.integration-event';
import {
  RUNNER_ENDED,
  type RunnerEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-ended.integration-event';
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
  mapping<HostOutageBegan>(
    'host-outage.began',
    (event): HostOutageBeganIntegrationEvent => ({
      kind: HOST_OUTAGE_BEGAN,
      outageId: event.outageId.value,
      workspaceId: event.workspaceId.value,
      source: event.source.kind,
      sourceKey: event.sourceKey,
      hosts: event.hosts,
      since: event.since.toISOString(),
    }),
  ),
  mapping<HostOutageEnded>(
    'host-outage.ended',
    (event): HostOutageEndedIntegrationEvent => ({
      kind: HOST_OUTAGE_ENDED,
      outageId: event.outageId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<RunnerEnded>(
    'runner.ended',
    (event): RunnerEndedIntegrationEvent => ({
      kind: RUNNER_ENDED,
      runnerId: event.runnerId.value,
      workspaceId: event.workspaceId.value,
      poolId: event.source.poolId?.value ?? null,
      trustId: event.source.trustId?.value ?? null,
      platform: event.platform,
      work: event.work && { kind: event.work.kind, id: event.work.id },
      startedAt: event.startedAt.toISOString(),
      claimedAt: event.claimedAt?.toISOString() ?? null,
      endedAt: event.endedAt.toISOString(),
      ending: event.ending,
    }),
  ),
] as const;

import type { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import {
  CONFIG_PULL_REQUEST_OPENED,
  type ConfigPullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/config-pull-request-opened.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const REPLAYS_EVENT_MAPPERS = [
  mapping<ConfigPullRequestOpened>(
    'replays.config-pull-request-opened',
    (event): ConfigPullRequestOpenedIntegrationEvent => ({
      kind: CONFIG_PULL_REQUEST_OPENED,
      configPullRequestId: event.pullRequestId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      stationId: event.stationId,
      fingerprint: event.proposing.value,
      url: event.url.value,
      at: event.at.toISOString(),
    }),
  ),
] as const;

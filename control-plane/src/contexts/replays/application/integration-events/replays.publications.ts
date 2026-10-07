import type { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import {
  CONFIG_PULL_REQUEST_OPENED,
  type ConfigPullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/config-pull-request-opened.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const REPLAYS_PUBLICATIONS = [
  publishing<ConfigPullRequestOpened>(
    'replays.config-pull-request-opened',
    (event): ConfigPullRequestOpenedIntegrationEvent => ({
      kind: CONFIG_PULL_REQUEST_OPENED,
      configPullRequestId: event.pullRequestId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      lineId: event.lineId,
      stationId: event.stationId,
      fingerprint: event.proposing.value,
      url: event.url,
      openedAt: event.at.toISOString(),
    }),
  ),
] as const;

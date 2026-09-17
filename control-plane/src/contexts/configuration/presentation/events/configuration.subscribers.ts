import { KEPT_UNDER } from '@configuration/application/contracts/configuration-layout.contract';
import type { ConfigurationNotices } from '@configuration/application/services/configuration-notices.service';
import type { ConfigurationMoveStarted } from '@configuration/domain/events/configuration-move-started.event';
import type { ConfigurationMoved } from '@configuration/domain/events/configuration-moved.event';
import type { ConfigurationPinned } from '@configuration/domain/events/configuration-pinned.event';
import type { ConfigurationRead } from '@configuration/domain/events/configuration-read.event';
import {
  DEFAULT_BRANCH_PUSHED,
  type DefaultBranchPushedIntegrationEvent,
} from '@github/application/integration-events/default-branch-pushed.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { LINES_UNDER } from '@work/application/contracts/line-layout.contract';
import type { ConfiguredLinesPort } from '@work/application/ports/configured-lines.port';
import type { SetupSettlingPort } from '@work/application/ports/setup-settling.port';

const touchesConfiguration = (paths: readonly string[]): boolean =>
  paths.some((path) => path.startsWith(`${KEPT_UNDER}/`));

export const configurationSubscribers = (
  settling: SetupSettlingPort,
  notices: ConfigurationNotices,
  lines: ConfiguredLinesPort,
): readonly DomainEventSubscriber[] => [
  subscribing<ConfigurationRead>(
    'configuration.apply-lines',
    ['configuration.read'],
    (event) =>
      lines.apply(
        event.teamId,
        event.files.filter((each) => each.isUnder(LINES_UNDER)),
      ),
  ),
  subscribing<
    | ConfigurationRead
    | ConfigurationPinned
    | ConfigurationMoveStarted
    | ConfigurationMoved
  >(
    'configuration.settle-team-setup',
    [
      'configuration.read',
      'configuration.pinned',
      'configuration.move-started',
      'configuration.moved',
    ],
    (event) => settling.forTeam(event.teamId),
  ),
  subscribing<DefaultBranchPushedIntegrationEvent>(
    'configuration.reread-pushed-configuration',
    [DEFAULT_BRANCH_PUSHED],
    async (event) => {
      if (touchesConfiguration(event.paths)) {
        await notices.touched({
          workspaceId: WorkspaceId.of(event.workspaceId),
          repository: event.repository,
        });
      }
    },
  ),
];

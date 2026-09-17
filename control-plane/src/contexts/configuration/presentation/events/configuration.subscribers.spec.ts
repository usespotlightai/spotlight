import type { ConfigurationNotices } from '@configuration/application/services/configuration-notices.service';
import { ConfigurationRead } from '@configuration/domain/events/configuration-read.event';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import type { DefaultBranchPushedIntegrationEvent } from '@github/application/integration-events/default-branch-pushed.integration-event';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ConfiguredLinesPort } from '@work/application/ports/configured-lines.port';
import type { SetupSettlingPort } from '@work/application/ports/setup-settling.port';
import { describe, expect, it, vi } from 'vitest';

const pushed = (
  paths: readonly string[],
): DefaultBranchPushedIntegrationEvent => ({
  kind: 'github.default-branch-pushed.v1',
  workspaceId: 'ws_1',
  repository: 'acme/api',
  paths,
});

const hearing = () => {
  const touched = vi.fn(async () => {});
  const subscriber = configurationSubscribers(
    {} as unknown as SetupSettlingPort,
    { touched } as unknown as ConfigurationNotices,
    {} as unknown as ConfiguredLinesPort,
  ).find((each) => each.kinds.includes('github.default-branch-pushed.v1'));

  if (!subscriber) {
    throw new Error('nobody hears a push');
  }

  return { subscriber, touched };
};

describe('configuration hearing a push to the default branch', () => {
  it('reads again where the push touched the configuration directory', async () => {
    const { subscriber, touched } = hearing();

    await subscriber.handle(
      pushed(['src/main.ts', '.spotlight/integrations/linear.yml']),
    );

    expect(touched).toHaveBeenCalledWith({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: 'acme/api',
    });
  });

  it('reads nothing where the push touched nothing of ours', async () => {
    const { subscriber, touched } = hearing();

    await subscriber.handle(pushed(['src/main.ts', '.spotlightish/x.yml']));

    expect(touched).not.toHaveBeenCalled();
  });
});

describe('configuration hearing its own read', () => {
  it('asks work to apply only the line files it read', async () => {
    const apply = vi.fn(async () => {});
    const subscriber = configurationSubscribers(
      {} as unknown as SetupSettlingPort,
      {} as unknown as ConfigurationNotices,
      { apply } as unknown as ConfiguredLinesPort,
    ).find((each) => each.name === 'configuration.apply-lines');
    const line = ConfigurationFile.of(
      '.spotlight/lines/delivery/line.yml',
      'name: Delivery',
    );

    await subscriber?.handle(
      new ConfigurationRead(
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        Commit.of('a'.repeat(40)),
        [
          line,
          ConfigurationFile.of('.spotlight/integrations/linear.yml', 'x: 1'),
        ],
      ),
    );

    expect(apply).toHaveBeenCalledWith(TeamId.of('team_1'), [line]);
  });
});

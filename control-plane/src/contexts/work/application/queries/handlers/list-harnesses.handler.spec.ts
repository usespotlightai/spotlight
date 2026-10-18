import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { MIN_HOST_RELEASE } from '@runners/application/contracts/least-host-release.contract';
import type {
  HostCredentials,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { LineImagesPort } from '@work/application/ports/line-images.port';
import { HostRequirementsHandler } from '@work/application/queries/handlers/host-requirements.handler';
import {
  HarnessCatalogueHandler,
  ListHarnessesHandler,
} from '@work/application/queries/handlers/list-harnesses.handler';
import { HostRequirementsQuery } from '@work/application/queries/host.queries';
import { ListHarnessesQuery } from '@work/application/queries/list-harnesses.query';
import { MIN_RUNNER_RELEASE } from '@work/application/services/least-runner-release';
import { describe, expect, it, vi } from 'vitest';

const launch = {
  catalogue: () => [
    {
      id: 'claude-code',
      name: 'Claude Code',
      executable: 'claude',
      efforts: ['low', 'high'],
      discovery: ['claude --version'],
      versionProbe: [],
    },
  ],
} as unknown as HarnessLaunchPort;

const handler = (member: boolean) => {
  const supportedModels = vi.fn(
    async () => new Map([['claude-code', ['claude-sonnet-5']]]),
  );
  const inWorkspace = vi.fn(async () =>
    member ? { workspaceId: WorkspaceId.of('ws_1') } : null,
  );

  return {
    supportedModels,
    inWorkspace,
    subject: new ListHarnessesHandler(
      launch,
      { inWorkspace } as unknown as WorkspaceAccessPort,
      { supportedModels } as unknown as RunnerReaderPort,
    ),
  };
};

describe('listing harnesses for a workspace', () => {
  it('offers only the models its own runners advertise', async () => {
    const { subject, supportedModels, inWorkspace } = handler(true);

    const listed = await subject.execute(
      new ListHarnessesQuery('acme', 'user_1'),
    );

    expect(inWorkspace).toHaveBeenCalledWith('acme', UserId.of('user_1'));
    expect(supportedModels).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
    expect(listed?.[0]?.models).toEqual([
      { id: 'claude-sonnet-5', name: 'claude-sonnet-5' },
    ]);
  });

  it('answers nothing to someone outside the workspace', async () => {
    const { subject, supportedModels } = handler(false);

    expect(
      await subject.execute(new ListHarnessesQuery('acme', 'user_1')),
    ).toBeNull();
    expect(supportedModels).not.toHaveBeenCalled();
  });

  it('tells a runner what to look for without any workspace’s models', async () => {
    const listed = await new HarnessCatalogueHandler(launch).execute();

    expect(listed).toEqual([
      expect.objectContaining({ id: 'claude-code', models: [] }),
    ]);
  });

  describe('for a host looking for what its runners should carry', () => {
    const authenticator: RunnerAuthenticatorPort = {
      authenticate: async (credential: HostCredentials) =>
        credential.bearer === 'pool-token'
          ? {
              source: { kind: 'pool', id: 'pool_1' },
              workspaceId: WorkspaceId.of('ws_1'),
            }
          : null,
    };

    const requirements = (release: string | null = '20261018-01') => {
      const namedIn = vi.fn(async () => ['ghcr.io/acme/widgets:1']);

      return {
        namedIn,
        subject: new HostRequirementsHandler(
          launch,
          authenticator,
          { namedIn } satisfies LineImagesPort,
          { release },
        ),
      };
    };

    it('tells an authenticated host the control plane’s release, the least host and runner releases, the harnesses to look for and the images its workspace’s lines name', async () => {
      const { subject, namedIn } = requirements();

      expect(
        await subject.execute(
          new HostRequirementsQuery({ bearer: 'pool-token', trust: undefined }),
        ),
      ).toEqual({
        hostRelease: '20261018-01',
        hostMinimum: MIN_HOST_RELEASE,
        runnerMinimum: MIN_RUNNER_RELEASE,
        harnesses: [expect.objectContaining({ id: 'claude-code', models: [] })],
        images: ['ghcr.io/acme/widgets:1'],
      });
      expect(namedIn).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
    });

    it('names no release for hosts to follow when the control plane runs a staging build, or does not know its release', async () => {
      for (const release of ['3d216a954c1e', 'develop', null]) {
        const { subject } = requirements(release);

        expect(
          await subject.execute(
            new HostRequirementsQuery({
              bearer: 'pool-token',
              trust: undefined,
            }),
          ),
        ).toMatchObject({ hostRelease: null });
      }
    });

    it('answers nothing to a host that no pool or trust accepts', async () => {
      const { subject, namedIn } = requirements();

      expect(
        await subject.execute(
          new HostRequirementsQuery({ bearer: 'stolen', trust: undefined }),
        ),
      ).toBeNull();
      expect(namedIn).not.toHaveBeenCalled();
    });
  });
});

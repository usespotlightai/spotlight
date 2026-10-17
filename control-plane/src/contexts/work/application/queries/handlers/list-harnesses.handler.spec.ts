import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  HostCredential,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
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
  const advertisedModels = vi.fn(
    async () => new Map([['claude-code', ['claude-sonnet-5']]]),
  );
  const inWorkspace = vi.fn(async () =>
    member ? { workspaceId: WorkspaceId.of('ws_1') } : null,
  );

  return {
    advertisedModels,
    inWorkspace,
    subject: new ListHarnessesHandler(
      launch,
      { inWorkspace } as unknown as WorkspaceAccessPort,
      { advertisedModels } as unknown as RunnerReaderPort,
    ),
  };
};

describe('listing harnesses for a workspace', () => {
  it('offers only the models its own runners advertise', async () => {
    const { subject, advertisedModels, inWorkspace } = handler(true);

    const listed = await subject.execute(
      new ListHarnessesQuery('acme', 'user_1'),
    );

    expect(inWorkspace).toHaveBeenCalledWith('acme', UserId.of('user_1'));
    expect(advertisedModels).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
    expect(listed?.[0]?.models).toEqual([
      { id: 'claude-sonnet-5', name: 'claude-sonnet-5' },
    ]);
  });

  it('answers nothing to someone outside the workspace', async () => {
    const { subject, advertisedModels } = handler(false);

    expect(
      await subject.execute(new ListHarnessesQuery('acme', 'user_1')),
    ).toBeNull();
    expect(advertisedModels).not.toHaveBeenCalled();
  });

  it('tells a runner what to look for without any workspace’s models', async () => {
    const listed = await new HarnessCatalogueHandler(launch).execute();

    expect(listed).toEqual([
      expect.objectContaining({ id: 'claude-code', models: [] }),
    ]);
  });

  describe('for a host looking for what its runners should carry', () => {
    const admissions: RunnerAdmissionsPort = {
      admit: async (credential: HostCredential) =>
        credential.bearer === 'pool-token'
          ? {
              way: { kind: 'pool', id: 'pool_1' },
              workspaceId: WorkspaceId.of('ws_1'),
            }
          : null,
    };

    const requirements = () => {
      const namedIn = vi.fn(async () => ['ghcr.io/acme/widgets:1']);

      return {
        namedIn,
        subject: new HostRequirementsHandler(launch, admissions, {
          namedIn,
        } satisfies LineImagesPort),
      };
    };

    it('tells an admitted host the least runner release, the harnesses to look for and the images its workspace’s lines name', async () => {
      const { subject, namedIn } = requirements();

      expect(
        await subject.execute(
          new HostRequirementsQuery({ bearer: 'pool-token', trust: undefined }),
        ),
      ).toEqual({
        runnerMinimum: MIN_RUNNER_RELEASE,
        harnesses: [expect.objectContaining({ id: 'claude-code', models: [] })],
        images: ['ghcr.io/acme/widgets:1'],
      });
      expect(namedIn).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
    });

    it('answers nothing to a host no pool or trust admits', async () => {
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

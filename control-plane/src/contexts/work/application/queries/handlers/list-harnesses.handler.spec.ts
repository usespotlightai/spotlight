import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerPoolsPort } from '@runners/application/ports/runner-pools.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import {
  HarnessCatalogueHandler,
  ListHarnessesHandler,
  PoolHarnessesHandler,
} from '@work/application/queries/handlers/list-harnesses.handler';
import { ListHarnessesQuery } from '@work/application/queries/list-harnesses.query';
import { PoolHarnessesQuery } from '@work/application/queries/pool.queries';
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

  describe('for a pool looking for what its runners should carry', () => {
    const pools = {
      pulledWith: async (token: string | undefined) =>
        token === 'pool-token' ? { poolId: 'pool_1' } : null,
    } as unknown as RunnerPoolsPort;

    it('tells a pool what to look for without any workspace’s models', async () => {
      expect(
        await new PoolHarnessesHandler(launch, pools).execute(
          new PoolHarnessesQuery('pool-token'),
        ),
      ).toEqual([expect.objectContaining({ id: 'claude-code', models: [] })]);
    });

    it('answers nothing to a token no pool pulls with', async () => {
      expect(
        await new PoolHarnessesHandler(launch, pools).execute(
          new PoolHarnessesQuery('stolen'),
        ),
      ).toBeNull();
    });
  });
});

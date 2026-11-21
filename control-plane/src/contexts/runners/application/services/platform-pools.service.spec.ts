import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { PlatformPoolSettings } from '@runners/application/ports/platform-pool-settings.port';
import { PlatformPools } from '@runners/application/services/platform-pools.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  anOwnPoolWithThePlatformKey,
  aPlatformPool,
  secretOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerPoolAlreadyExistsError } from '@runners/domain/exceptions/runner-pool-already-exists.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WS_1 = WorkspaceId.of('ws_1');
const WS_2 = WorkspaceId.of('ws_2');

const SETTINGS: PlatformPoolSettings = {
  url: ProvisionUrl.of('https://provision.deployment.example.com/runs'),
  secret: secretOf('m'),
  labels: RunnerLabels.of(['linux']),
  egress: EgressReference.platform(),
};

const BY = ChangeActor.spotlight(WS_1);

const settled = (pool: RunnerPool): RunnerPool => {
  pool.pullEvents();
  return pool;
};

const platformPools = (
  input: {
    stored?: readonly RunnerPool[];
    workspaces?: readonly WorkspaceId[];
    settings?: PlatformPoolSettings | null;
    added?: (pool: RunnerPool) => Promise<void>;
  } = {},
) => {
  const stored = input.stored ?? [];
  const added: RunnerPool[] = [];
  const saved: RunnerPool[] = [];
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const pools = {
    withKey: vi.fn(async (key: PoolKey) =>
      stored.filter((each) => each.key.equals(key)),
    ),
    inWorkspace: vi.fn(async (workspaceId: WorkspaceId) =>
      stored.filter((each) => each.belongsTo(workspaceId)),
    ),
    add: vi.fn(async (pool: RunnerPool) => {
      await input.added?.(pool);
      added.push(pool);
    }),
    save: vi.fn(async (pool: RunnerPool) => {
      saved.push(pool);
    }),
  };
  const workspaces = {
    openIds: vi.fn(async () => input.workspaces ?? [WS_1]),
    isOpen: vi.fn(async (workspaceId: WorkspaceId) =>
      (input.workspaces ?? [WS_1]).some((each) => each.equals(workspaceId)),
    ),
  };
  let generated = 0;

  return {
    added,
    saved,
    logger,
    platform: new PlatformPools(
      pools as unknown as RunnerPoolRepository,
      workspaces as unknown as WorkspaceReaderPort,
      input.settings === undefined ? SETTINGS : input.settings,
      { generate: () => `pool_${++generated}` },
      {
        inTransaction: (work: () => Promise<unknown>) => work(),
      } as TransactionPort,
      logger as unknown as LoggerPort,
    ),
  };
};

describe('PlatformPools', () => {
  describe('at startup', () => {
    it('adds the platform pool to each workspace that has none, with the labels and egress the deployment sets', async () => {
      const { platform, added } = platformPools({ workspaces: [WS_1, WS_2] });

      await platform.reconcile();

      expect(added.map((each) => each.workspaceId.value)).toEqual([
        'ws_1',
        'ws_2',
      ]);
      expect(added[0]?.isPlatform).toBe(true);
      expect(added[0]?.key.equals(PoolKey.platform())).toBe(true);
      expect(added[0]?.labels.values).toEqual(['linux']);
      expect(added[0]?.egress?.isPlatform).toBe(true);
    });

    it('gives an existing platform pool the labels and egress the deployment sets now, and keeps it disabled', async () => {
      const { platform, added, saved } = platformPools({
        stored: [settled(aPlatformPool({ labels: ['arm'], disabled: true }))],
      });

      await platform.reconcile();

      expect(added).toEqual([]);
      expect(saved[0]?.labels.values).toEqual(['linux']);
      expect(saved[0]?.isDisabled).toBe(true);
    });

    it('saves nothing for a platform pool that is already as the deployment sets it', async () => {
      const { platform, saved } = platformPools({
        stored: [
          settled(
            aPlatformPool({
              labels: ['linux'],
              egress: EgressReference.platform(),
            }),
          ),
        ],
      });

      await platform.reconcile();

      expect(saved).toEqual([]);
    });

    it('adds no platform pool to a workspace with its own pool of that key, and says so', async () => {
      const { platform, added, saved, logger } = platformPools({
        stored: [settled(anOwnPoolWithThePlatformKey())],
      });

      await platform.reconcile();

      expect(added).toEqual([]);
      expect(saved).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws_1' }),
        'Did not add the platform runner pool, because the workspace has its own pool spotlight',
      );
    });

    it('deletes the platform pools that are on while the deployment sets no platform provisioner, and keeps the disabled ones', async () => {
      const on = settled(aPlatformPool());
      const off = settled(aPlatformPool({ workspaceId: WS_2, disabled: true }));
      const { platform, added, saved } = platformPools({
        stored: [on, off],
        settings: null,
        workspaces: [WS_1, WS_2],
      });

      await platform.reconcile();

      expect(added).toEqual([]);
      expect(
        saved.map((each) => [each.workspaceId.value, each.isDeleted]),
      ).toEqual([['ws_1', true]]);
    });

    it('deletes a platform pool whose workspace is gone, also a disabled one', async () => {
      const { platform, saved } = platformPools({
        stored: [
          settled(aPlatformPool({ workspaceId: WS_2, disabled: true })),
          settled(aPlatformPool()),
        ],
        workspaces: [WS_1],
      });

      await platform.reconcile();

      expect(
        saved
          .filter((each) => each.isDeleted)
          .map((each) => each.workspaceId.value),
      ).toEqual(['ws_2']);
    });

    it('accepts that another instance added the pool first, and goes on', async () => {
      const { platform, logger } = platformPools({
        workspaces: [WS_1, WS_2],
        added: async (pool) => {
          if (pool.belongsTo(WS_1)) {
            throw new RunnerPoolAlreadyExistsError('spotlight');
          }
        },
      });

      await platform.reconcile();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('goes on with the other workspaces when one fails, and says so', async () => {
      const { platform, added, logger } = platformPools({
        workspaces: [WS_1, WS_2],
        added: async (pool) => {
          if (pool.belongsTo(WS_1)) {
            throw new Error('the database went away');
          }
        },
      });

      await platform.reconcile();

      expect(added.map((each) => each.workspaceId.value)).toEqual(['ws_2']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws_1' }),
        'Could not reconcile the platform runner pool of a workspace',
      );
    });
  });

  describe('when a workspace is created', () => {
    it('adds the platform pool to it', async () => {
      const { platform, added } = platformPools();

      await platform.add(WS_1);

      expect(added).toHaveLength(1);
    });

    it('adds nothing to a workspace that was deleted before the event arrived', async () => {
      const { platform, added } = platformPools({ workspaces: [] });

      await platform.add(WS_1);

      expect(added).toEqual([]);
    });

    it('adds nothing while the deployment sets no platform provisioner', async () => {
      const { platform, added } = platformPools({ settings: null });

      await platform.add(WS_1);

      expect(added).toEqual([]);
    });

    it('throws what fails, so that the event is delivered again', async () => {
      const { platform } = platformPools({
        added: async () => {
          throw new Error('the database went away');
        },
      });

      await expect(platform.add(WS_1)).rejects.toThrow(
        'the database went away',
      );
    });
  });

  describe('disabling and enabling the platform pool of a workspace', () => {
    it('disables the platform pool, and enables it again', async () => {
      const pool = settled(aPlatformPool());
      const { platform, saved } = platformPools({ stored: [pool] });

      await expect(platform.disable(WS_1, BY)).resolves.toEqual({
        outcome: 'disabled',
      });
      expect(saved[0]?.isDisabled).toBe(true);
    });

    it('enables a disabled platform pool', async () => {
      const { platform, saved } = platformPools({
        stored: [settled(aPlatformPool({ disabled: true }))],
      });

      await expect(platform.enable(WS_1, BY)).resolves.toEqual({
        outcome: 'enabled',
      });
      expect(saved[0]?.isDisabled).toBe(false);
    });

    it('adds the platform pool disabled where it is missing', async () => {
      const { platform, added } = platformPools();

      await expect(platform.disable(WS_1, BY)).resolves.toEqual({
        outcome: 'disabled',
      });
      expect(added[0]?.isDisabled).toBe(true);
    });

    it('changes nothing in a workspace with its own pool of that key', async () => {
      const { platform, added, saved } = platformPools({
        stored: [settled(anOwnPoolWithThePlatformKey())],
      });

      await expect(platform.disable(WS_1, BY)).resolves.toEqual({
        outcome: 'key-taken',
      });
      expect(added).toEqual([]);
      expect(saved).toEqual([]);
    });

    it('says so while the deployment sets no platform provisioner', async () => {
      const { platform } = platformPools({ settings: null });

      await expect(platform.enable(WS_1, BY)).resolves.toEqual({
        outcome: 'unset',
      });
    });

    it('answers nothing for a workspace that is not open', async () => {
      const { platform } = platformPools({ workspaces: [] });

      await expect(platform.disable(WS_1, BY)).resolves.toBeNull();
    });
  });
});

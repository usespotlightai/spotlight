import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ManagedPoolSettings } from '@runners/application/ports/managed-pool-settings.port';
import { ManagedPools } from '@runners/application/services/managed-pools.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aManagedPool,
  aPushPool,
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
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WS_1 = WorkspaceId.of('ws_1');
const WS_2 = WorkspaceId.of('ws_2');

const SETTINGS: ManagedPoolSettings = {
  url: ProvisionUrl.of('https://provision.deployment.example.com/runs'),
  secret: secretOf('m'),
  labels: RunnerLabels.of(['linux']),
  egress: EgressReference.platform(),
};

const settled = (pool: RunnerPool): RunnerPool => {
  pool.pullEvents();
  return pool;
};

const managing = (
  input: {
    stored?: readonly RunnerPool[];
    workspaces?: readonly WorkspaceId[];
    settings?: ManagedPoolSettings | null;
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
    managed: new ManagedPools(
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

describe('ManagedPools', () => {
  describe('at startup', () => {
    it('adds the managed pool to each workspace that has none, with the labels and egress the deployment sets', async () => {
      const { managed, added } = managing({ workspaces: [WS_1, WS_2] });

      await managed.reconcile();

      expect(added.map((each) => each.workspaceId.value)).toEqual([
        'ws_1',
        'ws_2',
      ]);
      expect(added[0]?.isManaged).toBe(true);
      expect(added[0]?.key.equals(PoolKey.managed())).toBe(true);
      expect(added[0]?.labels.values).toEqual(['linux']);
      expect(added[0]?.egress?.isPlatform).toBe(true);
    });

    it('gives an existing managed pool the labels and egress the deployment sets now, and keeps it disabled', async () => {
      const { managed, added, saved } = managing({
        stored: [settled(aManagedPool({ labels: ['arm'], disabled: true }))],
      });

      await managed.reconcile();

      expect(added).toEqual([]);
      expect(saved[0]?.labels.values).toEqual(['linux']);
      expect(saved[0]?.isDisabled).toBe(true);
    });

    it('saves nothing for a managed pool that is already as the deployment sets it', async () => {
      const { managed, saved } = managing({
        stored: [
          settled(
            aManagedPool({
              labels: ['linux'],
              egress: EgressReference.platform(),
            }),
          ),
        ],
      });

      await managed.reconcile();

      expect(saved).toEqual([]);
    });

    it('adds no managed pool to a workspace with its own pool of that key, and says so', async () => {
      const { managed, added, saved, logger } = managing({
        stored: [settled(aPushPool({ key: 'spotlight' }))],
      });

      await managed.reconcile();

      expect(added).toEqual([]);
      expect(saved).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws_1' }),
        'Did not add the managed runner pool, because the workspace has its own pool spotlight',
      );
    });

    it('deletes the managed pools that are on while the deployment sets no managed provisioner, and keeps the disabled ones', async () => {
      const on = settled(aManagedPool());
      const off = settled(aManagedPool({ workspaceId: WS_2, disabled: true }));
      const { managed, added, saved } = managing({
        stored: [on, off],
        settings: null,
        workspaces: [WS_1, WS_2],
      });

      await managed.reconcile();

      expect(added).toEqual([]);
      expect(
        saved.map((each) => [each.workspaceId.value, each.isDeleted]),
      ).toEqual([['ws_1', true]]);
    });

    it('accepts that another instance added the pool first, and goes on', async () => {
      const { managed, logger } = managing({
        workspaces: [WS_1, WS_2],
        added: async (pool) => {
          if (pool.belongsTo(WS_1)) {
            throw new RunnerPoolAlreadyExistsError('spotlight');
          }
        },
      });

      await managed.reconcile();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('goes on with the other workspaces when one fails, and says so', async () => {
      const { managed, added, logger } = managing({
        workspaces: [WS_1, WS_2],
        added: async (pool) => {
          if (pool.belongsTo(WS_1)) {
            throw new Error('the database went away');
          }
        },
      });

      await managed.reconcile();

      expect(added.map((each) => each.workspaceId.value)).toEqual(['ws_2']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws_1' }),
        'Could not reconcile the managed runner pool of a workspace',
      );
    });
  });

  describe('when a workspace is created', () => {
    it('adds the managed pool to it', async () => {
      const { managed, added } = managing();

      await managed.createFor(WS_1);

      expect(added).toHaveLength(1);
    });

    it('adds nothing to a workspace that was deleted before the event arrived', async () => {
      const { managed, added } = managing({ workspaces: [] });

      await managed.createFor(WS_1);

      expect(added).toEqual([]);
    });

    it('adds nothing while the deployment sets no managed provisioner', async () => {
      const { managed, added } = managing({ settings: null });

      await managed.createFor(WS_1);

      expect(added).toEqual([]);
    });

    it('throws what fails, so that the event is delivered again', async () => {
      const { managed } = managing({
        added: async () => {
          throw new Error('the database went away');
        },
      });

      await expect(managed.createFor(WS_1)).rejects.toThrow(
        'the database went away',
      );
    });
  });

  describe('turning the managed pool of a workspace off and on', () => {
    it('disables the managed pool, and enables it again', async () => {
      const pool = settled(aManagedPool());
      const { managed, saved } = managing({ stored: [pool] });

      await expect(
        managed.update(WS_1, true, changeActorIn()),
      ).resolves.toEqual({ outcome: 'updated', disabled: true });
      expect(saved[0]?.isDisabled).toBe(true);
    });

    it('adds the managed pool disabled where it is missing', async () => {
      const { managed, added } = managing();

      await expect(
        managed.update(WS_1, true, changeActorIn()),
      ).resolves.toEqual({ outcome: 'updated', disabled: true });
      expect(added[0]?.isDisabled).toBe(true);
    });

    it('changes nothing in a workspace with its own pool of that key', async () => {
      const { managed, added, saved } = managing({
        stored: [settled(aPushPool({ key: 'spotlight' }))],
      });

      await expect(
        managed.update(WS_1, true, changeActorIn()),
      ).resolves.toEqual({ outcome: 'owned' });
      expect(added).toEqual([]);
      expect(saved).toEqual([]);
    });

    it('says so while the deployment sets no managed provisioner', async () => {
      const { managed } = managing({ settings: null });

      await expect(
        managed.update(WS_1, true, changeActorIn()),
      ).resolves.toEqual({ outcome: 'off' });
    });

    it('answers nothing for a workspace that is not open', async () => {
      const { managed } = managing({ workspaces: [] });

      await expect(
        managed.update(WS_1, true, changeActorIn()),
      ).resolves.toBeNull();
    });
  });
});

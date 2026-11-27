import type { WorkspaceDirectoryPort } from '@identity/application/ports/workspace-directory.port';
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
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WS_1 = WorkspaceId.of('ws_1');
const WS_2 = WorkspaceId.of('ws_2');

const SETTINGS: PlatformPoolSettings = {
  url: ProvisionUrl.of('https://provision.deployment.example.com/runs'),
  secret: secretOf('m'),
  labels: RunnerLabels.of(['linux']),
  egress: EgressReference.platform(),
  images: null,
  allows: {},
};

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
    withKey: vi.fn((key: PoolKey) =>
      Promise.resolve(stored.filter((each) => each.key.equals(key))),
    ),
    findByKey: vi.fn((workspaceId: WorkspaceId, key: PoolKey) =>
      Promise.resolve(
        stored.find(
          (each) => each.belongsTo(workspaceId) && each.key.equals(key),
        ) ?? null,
      ),
    ),
    add: vi.fn(async (pool: RunnerPool) => {
      await input.added?.(pool);
      added.push(pool);
    }),
    save: vi.fn((pool: RunnerPool) => {
      saved.push(pool);
      return Promise.resolve();
    }),
  };
  const open = input.workspaces ?? [WS_1];
  const workspaces = {
    isOpen: vi.fn((workspaceId: WorkspaceId) =>
      Promise.resolve(open.some((each) => each.equals(workspaceId))),
    ),
  };
  // One workspace a page, so that the reconcile reads every page.
  const directory = {
    list: vi.fn((request: { after: string | null }) => {
      const at = request.after === null ? 0 : Number(request.after);
      const workspace = at < open.length ? open[at] : undefined;

      return Promise.resolve({
        items:
          workspace === undefined
            ? []
            : [
                {
                  id: workspace,
                  slug: workspace.value,
                  name: workspace.value,
                  createdAt: new Date(0),
                  memberCount: 1,
                },
              ],
        next: at + 1 < open.length ? String(at + 1) : null,
      });
    }),
  };
  let generated = 0;

  return {
    added,
    saved,
    logger,
    platform: new PlatformPools(
      partial<RunnerPoolRepository>(pools),
      partial<WorkspaceReaderPort>(workspaces),
      partial<WorkspaceDirectoryPort>(directory),
      input.settings === undefined ? SETTINGS : input.settings,
      { generate: () => `pool_${++generated}` },
      partial<TransactionPort>({
        inTransaction: <T>(work: () => Promise<T>) => work(),
      }),
      partial<LoggerPort>(logger),
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

    it('starts a new platform pool with the work the deployment allows it, and leaves an existing one as the operator set it', async () => {
      const allowing = {
        ...SETTINGS,
        allows: { allowsSecrets: true, allowsReviewWork: true },
      };
      const fresh = platformPools({ settings: allowing });

      await fresh.platform.reconcile();

      expect(fresh.added[0]?.allowsSecrets).toBe(true);
      expect(fresh.added[0]?.allowsReviewWork).toBe(true);

      const kept = platformPools({
        settings: allowing,
        stored: [settled(aPlatformPool({ labels: ['linux'] }))],
      });

      await kept.platform.reconcile();

      expect(kept.saved.every((each) => !each.allowsSecrets)).toBe(true);
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
        added: (pool) => {
          if (pool.belongsTo(WS_1)) {
            return Promise.reject(
              new RunnerPoolAlreadyExistsError('spotlight'),
            );
          }
          return Promise.resolve();
        },
      });

      await platform.reconcile();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('goes on with the other workspaces when one fails, and says so', async () => {
      const { platform, added, logger } = platformPools({
        workspaces: [WS_1, WS_2],
        added: (pool) => {
          if (pool.belongsTo(WS_1)) {
            return Promise.reject(new Error('the database went away'));
          }
          return Promise.resolve();
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
        added: () => {
          return Promise.reject(new Error('the database went away'));
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

      await expect(platform.set(WS_1, { enabled: false })).resolves.toEqual({
        outcome: 'disabled',
        allowsSecrets: false,
        allowsReviewWork: false,
      });
      expect(saved[0]?.isDisabled).toBe(true);
    });

    it('enables a disabled platform pool', async () => {
      const { platform, saved } = platformPools({
        stored: [settled(aPlatformPool({ disabled: true }))],
      });

      await expect(platform.set(WS_1, { enabled: true })).resolves.toEqual({
        outcome: 'enabled',
        allowsSecrets: false,
        allowsReviewWork: false,
      });
      expect(saved[0]?.isDisabled).toBe(false);
    });

    it('adds the platform pool disabled where it is missing', async () => {
      const { platform, added } = platformPools();

      await expect(platform.set(WS_1, { enabled: false })).resolves.toEqual({
        outcome: 'disabled',
        allowsSecrets: false,
        allowsReviewWork: false,
      });
      expect(added[0]?.isDisabled).toBe(true);
    });

    it('changes nothing in a workspace with its own pool of that key', async () => {
      const { platform, added, saved } = platformPools({
        stored: [settled(anOwnPoolWithThePlatformKey())],
      });

      await expect(platform.set(WS_1, { enabled: false })).resolves.toEqual({
        outcome: 'key-taken',
      });
      expect(added).toEqual([]);
      expect(saved).toEqual([]);
    });

    it('says so while the deployment sets no platform provisioner', async () => {
      const { platform } = platformPools({ settings: null });

      await expect(platform.set(WS_1, { enabled: true })).resolves.toEqual({
        outcome: 'unset',
      });
    });

    it('answers nothing for a workspace that is not open, also while the deployment sets no platform provisioner', async () => {
      const { platform } = platformPools({ workspaces: [], settings: null });

      await expect(platform.set(WS_1, { enabled: true })).resolves.toBeNull();
    });

    it('records the change as made by Spotlight', async () => {
      const pool = settled(aPlatformPool());
      const { platform, saved } = platformPools({ stored: [pool] });

      await platform.set(WS_1, { enabled: false });

      const [updated] = saved[0]?.pullEvents() ?? [];

      expect(updated).toMatchObject({
        change: { by: { actor: null, workspaceId: WS_1 } },
      });
    });

    it('answers nothing for a workspace that is not open', async () => {
      const { platform } = platformPools({ workspaces: [] });

      await expect(platform.set(WS_1, { enabled: false })).resolves.toBeNull();
    });
  });

  describe('allowing the platform pool of a workspace work', () => {
    it('allows secrets, keeps review work as it is, and records the change as made by Spotlight', async () => {
      const { platform, saved } = platformPools({
        stored: [
          settled(aPlatformPool({ allows: { allowsReviewWork: true } })),
        ],
      });

      await expect(
        platform.set(WS_1, { allowsSecrets: true }),
      ).resolves.toEqual({
        outcome: 'enabled',
        allowsSecrets: true,
        allowsReviewWork: true,
      });
      const events = saved[0]?.pullEvents() ?? [];

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        change: { by: { actor: null, workspaceId: WS_1 } },
      });
    });

    it('writes nothing when the pool already allows that work', async () => {
      const { platform, saved } = platformPools({
        stored: [settled(aPlatformPool({ allows: { allowsSecrets: true } }))],
      });

      await platform.set(WS_1, { allowsSecrets: true });

      expect(saved).toEqual([]);
    });

    it('keeps what it allows when the deployment changes the platform pool', async () => {
      const pool = settled(
        aPlatformPool({
          allows: { allowsSecrets: true, allowsReviewWork: true },
        }),
      );
      const { platform, saved } = platformPools({ stored: [pool] });

      await platform.set(WS_1, { enabled: false });

      expect(saved[0]?.allowsSecrets).toBe(true);
      expect(saved[0]?.allowsReviewWork).toBe(true);
    });
  });
});

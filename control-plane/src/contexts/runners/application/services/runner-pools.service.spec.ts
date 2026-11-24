import type {
  AuthenticatedHost,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import { RunnerPools } from '@runners/application/services/runner-pools.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPlatformPool,
  aPullPool,
  aPushPool,
  aRunner,
  aTrust,
  POOL_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const NOW = new Date('2026-09-24T10:00:00.000Z');

const pooling = (
  authenticated: AuthenticatedHost | null,
  stored: {
    pool?: RunnerPool | null;
    alive?: readonly Runner[];
    idleSandboxes?: readonly SandboxId[];
    provisioning?: readonly RunnerPool[];
    trusts?: readonly RunnerTrust[];
    platform?: boolean;
    platformPool?: boolean;
    platformImages?: readonly RunnerImage[] | null;
  } = {},
) => {
  const authenticate = vi.fn(async () => authenticated);
  const find = vi.fn(async () =>
    stored.pool === undefined ? aPullPool({ maxRuns: 2 }) : stored.pool,
  );

  const inWorkspaces = vi.fn(async () => stored.provisioning ?? []);

  const pools = new RunnerPools(
    { find, inWorkspaces } as unknown as RunnerPoolRepository,
    {
      inWorkspaces: vi.fn(async () => stored.trusts ?? []),
    } as unknown as RunnerTrustRepository,
    {
      aliveIn: vi.fn(async () => stored.alive ?? []),
    } as unknown as RunnerRepository,
    {
      idleInPool: vi.fn(async () => stored.idleSandboxes ?? []),
    } as unknown as SandboxPlacementsPort,
    { authenticate } satisfies RunnerAuthenticatorPort,
    {
      platformEgressSet: stored.platform ?? true,
      platformPoolSet: stored.platformPool ?? true,
      platformImages: stored.platformImages ?? null,
    },
  );

  return { pools, authenticate, find, inWorkspaces };
};

const THROUGH_POOL: AuthenticatedHost = {
  source: { kind: 'pool', id: POOL_ID.value },
  workspaceId: WORKSPACE,
  workingCopies: null,
};

describe('RunnerPools', () => {
  describe('the pool a token pulls with', () => {
    it('answers the pool the authenticator accepts the token for, at work', async () => {
      const { pools, authenticate } = pooling(THROUGH_POOL);

      await expect(
        pools.pulledWith('pool-token', POOL_ID.value),
      ).resolves.toEqual({
        poolId: POOL_ID.value,
        workspaceId: WORKSPACE,
        key: 'ephemeral',
        labels: expect.objectContaining({ values: ['linux'] }) as unknown,
        egress: false,
        platform: false,
        images: null,
        allowsSecrets: true,
        allowsReviewWork: true,
      });
      expect(authenticate).toHaveBeenCalledWith({
        bearer: 'pool-token',
        trust: undefined,
      });
    });

    it('answers no pool for another pool than the token’s own', async () => {
      const { pools, find } = pooling(THROUGH_POOL);

      await expect(
        pools.pulledWith('pool-token', 'pool_2'),
      ).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });

    it('answers no pool where the authenticator accepts nothing', async () => {
      const { pools, find } = pooling(null);

      await expect(
        pools.pulledWith('stolen', POOL_ID.value),
      ).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });

    it('answers no pool for a credential source that is a trust', async () => {
      const { pools, find } = pooling({
        source: { kind: 'trust', id: 'trust_1' },
        workspaceId: WORKSPACE,
        workingCopies: null,
      });

      await expect(
        pools.pulledWith('workload-token', 'trust_1'),
      ).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });
  });

  describe('the pools that provision, and what hosts take', () => {
    const PLATFORM = EgressReference.platform();
    const NAMED = EgressReference.to(EgressId.of('egress_1'));

    it('reads the pools and trusts of the workspaces it is given, once', async () => {
      const { pools, inWorkspaces } = pooling(null, {
        provisioning: [aPushPool()],
      });

      await pools.offersIn([WORKSPACE]);

      expect(inWorkspaces).toHaveBeenCalledExactlyOnceWith([WORKSPACE]);
    });

    it('says of each pool whether it names an egress', async () => {
      const { pools } = pooling(null, {
        provisioning: [
          aPushPool({ egress: PLATFORM }),
          aPushPool({ egress: NAMED }),
          aPushPool(),
        ],
      });

      expect((await pools.offersIn([WORKSPACE])).pools).toEqual([
        expect.objectContaining({ egress: true }),
        expect.objectContaining({ egress: true }),
        expect.objectContaining({ egress: false }),
      ]);
    });

    it('counts the platform egress only where the deployment has one', async () => {
      const { pools } = pooling(null, {
        provisioning: [
          aPushPool({ egress: PLATFORM }),
          aPushPool({ egress: NAMED }),
        ],
        platform: false,
      });

      expect((await pools.offersIn([WORKSPACE])).pools).toEqual([
        expect.objectContaining({ egress: false }),
        expect.objectContaining({ egress: true }),
      ]);
    });

    it('marks the platform pool, which has no run limit', async () => {
      const { pools } = pooling(null, {
        provisioning: [
          aPushPool(),
          aPlatformPool({
            egress: PLATFORM,
            allows: { allowsSecrets: true, allowsReviewWork: true },
          }),
        ],
      });

      expect((await pools.offersIn([WORKSPACE])).pools).toEqual([
        expect.objectContaining({
          key: 'sandboxes',
          platform: false,
          allowsSecrets: true,
          allowsReviewWork: true,
        }),
        expect.objectContaining({
          key: 'spotlight',
          platform: true,
          egress: true,
          allowsSecrets: true,
          allowsReviewWork: true,
        }),
      ]);
    });

    it('offers the platform pool with the images the deployment names, and a pool of the workspace with any image', async () => {
      const images = [RunnerImage.of('ghcr.io/acme/runner:main')];
      const { pools } = pooling(null, {
        provisioning: [aPushPool(), aPlatformPool()],
        platformImages: images,
      });

      expect(
        (await pools.offersIn([WORKSPACE])).pools.map((each) => each.images),
      ).toEqual([null, images]);
    });

    it('offers the platform pool with its egress, yet refusing secrets and review work until the operator allows them for the workspace', async () => {
      const { pools } = pooling(null, {
        provisioning: [aPlatformPool({ egress: PLATFORM })],
      });

      expect((await pools.offersIn([WORKSPACE])).pools).toEqual([
        expect.objectContaining({
          key: 'spotlight',
          egress: true,
          allowsSecrets: false,
          allowsReviewWork: false,
        }),
      ]);
    });

    it('offers no pull pool as a pool, and says what the hosts of the pull pools and trusts can take, naming no pool', async () => {
      const { pools } = pooling(null, {
        provisioning: [aPullPool(), aPushPool(), aPlatformPool()],
        trusts: [aTrust()],
      });

      const offers = await pools.offersIn([WORKSPACE]);

      expect(offers.pools.map((each) => each.key)).toEqual([
        'sandboxes',
        'spotlight',
      ]);
      expect(offers.hostOffers.map((each) => each.labels.values)).toEqual([
        ['linux'],
        ['vpc-internal'],
      ]);
      expect(offers.hostOffers.every((each) => each.egress)).toBe(true);
      expect(offers.hostOffers.every((each) => !('poolId' in each))).toBe(true);
    });

    it('leaves out a disabled platform pool', async () => {
      const { pools } = pooling(null, {
        provisioning: [aPlatformPool({ disabled: true })],
      });

      expect((await pools.offersIn([WORKSPACE])).pools).toEqual([]);
    });

    it('leaves out the platform pool while the deployment sets no platform provisioner', async () => {
      const { pools } = pooling(null, {
        provisioning: [aPushPool(), aPlatformPool()],
        platformPool: false,
      });

      expect((await pools.offersIn([WORKSPACE])).pools).toEqual([
        expect.objectContaining({ key: 'sandboxes' }),
      ]);
    });
  });

  describe('the room a pool has left', () => {
    it('is what maxRuns leaves beside the runners that are alive in it', async () => {
      const { pools } = pooling(null, { alive: [aRunner()] });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBe(1);
    });

    it('counts a live sandbox no run is in against maxRuns, as starting a runner does', async () => {
      const { pools } = pooling(null, {
        alive: [aRunner()],
        idleSandboxes: [SandboxId.of('sandbox_1')],
      });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBe(0);
      await expect(pools.running(POOL_ID.value, NOW)).resolves.toBe(1);
    });

    it('counts an idle sandbox once while a runner waits to enter it', async () => {
      const { pools } = pooling(null, {
        alive: [aRunner({ enters: 'sandbox_1' })],
        idleSandboxes: [SandboxId.of('sandbox_1')],
      });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBe(1);
      await expect(pools.running(POOL_ID.value, NOW)).resolves.toBe(1);
    });

    it('is unbounded for a pool without maxRuns', async () => {
      const { pools } = pooling(null, {
        pool: aPullPool(),
        alive: [aRunner(), aRunner({ id: 'pooled_2' })],
      });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBeNull();
    });

    it('is none for a pool that is gone or deleted', async () => {
      await expect(
        pooling(null, { pool: null }).pools.roomIn(POOL_ID.value, NOW),
      ).resolves.toBe(0);
      await expect(
        pooling(null, {
          pool: aPullPool().delete(changeActorIn()),
        }).pools.roomIn(POOL_ID.value, NOW),
      ).resolves.toBe(0);
    });
  });
});

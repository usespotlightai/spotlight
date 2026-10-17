import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import { RunnerEgress } from '@runners/application/services/runner-egress.service';
import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import {
  anEgress,
  EGRESS_ID,
} from '@runners/domain/aggregates/egress.fake-spec';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPushPool,
  aRunner,
  hashOf,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const HASHES: Readonly<Record<string, string>> = {
  'egress-token': 'e',
  'platform-token': '7',
  'shared-token': '9',
  'proxy-credential': 'd',
};

const PLATFORM: PlatformEgressSettings = {
  url: EgressUrl.of('https://egress.usespotlight.ai'),
  tokenHash: hashOf('7'),
};

const egressOf = (
  stored: Runner | null,
  given: {
    pool?: RunnerPool | null;
    egress?: Egress | null;
    platform?: PlatformEgressSettings | null;
    open?: boolean;
  } = {},
) =>
  new RunnerEgress(
    {
      findByEgressTokenHash: async (hash: TokenHash) =>
        stored?.egressTokenHash?.equals(hash) ? stored : null,
      findByProxyCredentialHash: async (hash: TokenHash) =>
        stored?.proxyCredentialHash?.equals(hash) ? stored : null,
    } as unknown as RunnerRepository,
    {
      hash: (token: string) => (HASHES[token] ?? 'f').repeat(64),
    } as TokenMintPort,
    {
      find: async () => given.egress ?? null,
      findByTokenHash: async (hash: TokenHash) =>
        given.egress?.tokenHash.equals(hash) ? given.egress : null,
    } as unknown as EgressRepository,
    {
      find: async () => given.pool ?? null,
    } as unknown as RunnerPoolRepository,
    {
      isOpen: async () => given.open ?? true,
    } as unknown as WorkspaceReaderPort,
    given.platform === undefined ? PLATFORM : given.platform,
  );

const throughShared = () =>
  aPushPool({ egress: EgressReference.to(EGRESS_ID) });

const proxied = (pool: RunnerPool) =>
  aRunner({ through: pool, host: null, proxyCredentialHash: hashOf('d') });

describe('RunnerEgress', () => {
  it('admits the egress of a runner with a lease on its work, for that work', async () => {
    const runner = aRunner().took(RunnerWork.run('run_1'), later(1));

    await expect(
      egressOf(runner).admit('egress-token', later(2)),
    ).resolves.toEqual({
      runnerId: runner.id.value,
      workspaceId: runner.workspaceId.value,
      work: { kind: 'run', id: 'run_1' },
    });
  });

  it('refuses no token, an unknown one, and a runner that leases nothing or has ended', async () => {
    const waiting = aRunner();
    const ended = waiting
      .took(RunnerWork.check('stack_1'), later(1))
      .ended(later(2));

    await expect(
      egressOf(waiting).admit(undefined, later(1)),
    ).resolves.toBeNull();
    await expect(
      egressOf(waiting).admit('other', later(1)),
    ).resolves.toBeNull();
    await expect(
      egressOf(waiting).admit('egress-token', later(1)),
    ).resolves.toBeNull();
    await expect(
      egressOf(ended).admit('egress-token', later(3)),
    ).resolves.toBeNull();
  });

  it('keeps the egress token apart from the runner’s own', () => {
    const runner = aRunner();

    expect(runner.egressTokenHash?.equals(runner.tokenHash)).toBe(false);
    expect(runner.egressTokenHash?.equals(hashOf('e'))).toBe(true);
  });

  describe('knowing a shared egress by its token', () => {
    it('knows the platform egress by the deployment’s token', async () => {
      await expect(
        egressOf(null).sharedWith('platform-token'),
      ).resolves.toEqual({ egressId: 'spotlight' });
    });

    it('knows an egress of an open workspace by its token', async () => {
      await expect(
        egressOf(null, { egress: anEgress() }).sharedWith('shared-token'),
      ).resolves.toEqual({ egressId: EGRESS_ID.value });
    });

    it('knows no egress without a token, by an unknown one, without a platform egress, or in a closed workspace', async () => {
      await expect(egressOf(null).sharedWith(undefined)).resolves.toBeNull();
      await expect(egressOf(null).sharedWith('other')).resolves.toBeNull();
      await expect(
        egressOf(null, { platform: null }).sharedWith('platform-token'),
      ).resolves.toBeNull();
      await expect(
        egressOf(null, { egress: anEgress(), open: false }).sharedWith(
          'shared-token',
        ),
      ).resolves.toBeNull();
      await expect(
        egressOf(null, {
          egress: anEgress().retire([], attributedIn()),
        }).sharedWith('shared-token'),
      ).resolves.toBeNull();
    });
  });

  describe('admitting a runner through a shared egress', () => {
    it('admits a standing runner whose pool names the egress, before it claims and with its work after', async () => {
      const pool = throughShared();
      const waiting = proxied(pool);
      const egress = { egressId: EGRESS_ID.value };

      await expect(
        egressOf(waiting, { pool, egress: anEgress() }).admitThrough(
          egress,
          'proxy-credential',
          later(1),
        ),
      ).resolves.toEqual({
        egressId: EGRESS_ID.value,
        runnerId: waiting.id.value,
        workspaceId: waiting.workspaceId.value,
        work: null,
      });

      const working = waiting.took(RunnerWork.run('run_1'), later(1));

      await expect(
        egressOf(working, { pool, egress: anEgress() }).admitThrough(
          egress,
          'proxy-credential',
          later(2),
        ),
      ).resolves.toMatchObject({ work: { kind: 'run', id: 'run_1' } });
    });

    it('admits a runner through the platform egress when its pool names spotlight', async () => {
      const pool = aPushPool({ egress: EgressReference.platform() });

      await expect(
        egressOf(proxied(pool), { pool }).admitThrough(
          { egressId: 'spotlight' },
          'proxy-credential',
          later(1),
        ),
      ).resolves.toMatchObject({ egressId: 'spotlight', work: null });
    });

    it('refuses an unknown credential, a runner that no longer stands, and a pool that names another egress', async () => {
      const pool = throughShared();
      const runner = proxied(pool);
      const egress = { egressId: EGRESS_ID.value };
      const setting = { pool, egress: anEgress() };

      await expect(
        egressOf(runner, setting).admitThrough(egress, 'other', later(1)),
      ).resolves.toBeNull();
      await expect(
        egressOf(runner, setting).admitThrough(egress, '', later(1)),
      ).resolves.toBeNull();
      await expect(
        egressOf(runner.ended(later(1)), setting).admitThrough(
          egress,
          'proxy-credential',
          later(2),
        ),
      ).resolves.toBeNull();
      await expect(
        egressOf(runner, setting).admitThrough(
          { egressId: 'spotlight' },
          'proxy-credential',
          later(1),
        ),
      ).resolves.toBeNull();
      await expect(
        egressOf(runner, setting).admitThrough(
          { egressId: 'egress_2' },
          'proxy-credential',
          later(1),
        ),
      ).resolves.toBeNull();
    });

    it('lets the egress record for a runner’s work for two minutes after the runner ended, but admits it no more', async () => {
      const pool = throughShared();
      const ended = proxied(pool)
        .took(RunnerWork.run('run_1'), later(1))
        .ended(later(2));
      const egress = { egressId: EGRESS_ID.value };
      const setting = { pool, egress: anEgress() };

      await expect(
        egressOf(ended, setting).recordsThrough(
          egress,
          'proxy-credential',
          later(2 + 120_000),
        ),
      ).resolves.toEqual({
        egressId: EGRESS_ID.value,
        runnerId: ended.id.value,
        workspaceId: ended.workspaceId.value,
        work: { kind: 'run', id: 'run_1' },
      });
      await expect(
        egressOf(ended, setting).recordsThrough(
          egress,
          'proxy-credential',
          later(2 + 120_001),
        ),
      ).resolves.toBeNull();
      await expect(
        egressOf(ended, setting).recordsThrough(
          { egressId: 'egress_2' },
          'proxy-credential',
          later(3),
        ),
      ).resolves.toBeNull();
      await expect(
        egressOf(ended, setting).admitThrough(
          egress,
          'proxy-credential',
          later(3),
        ),
      ).resolves.toBeNull();
    });

    it('refuses a runner whose pool is gone, or an egress of another workspace', async () => {
      const pool = throughShared();
      const runner = proxied(pool);
      const egress = { egressId: EGRESS_ID.value };

      await expect(
        egressOf(runner, { pool: null, egress: anEgress() }).admitThrough(
          egress,
          'proxy-credential',
          later(1),
        ),
      ).resolves.toBeNull();
      await expect(
        egressOf(runner, {
          pool,
          egress: anEgress({ workspaceId: WorkspaceId.of('ws_other') }),
        }).admitThrough(egress, 'proxy-credential', later(1)),
      ).resolves.toBeNull();
    });
  });
});

import { RunnerPresence } from '@runners/application/services/runner-presence.service';
import type { PoolRunner } from '@runners/domain/aggregates/pool-runner.aggregate';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import {
  aPoolRunner,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerMovedOnError } from '@runners/domain/exceptions/runner-moved-on.error';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { PoolWork } from '@runners/domain/value-objects/pool-work.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ID = RunnerId.of('runner_1');
const NO_TRUSTS = {
  find: vi.fn(async () => null),
} as unknown as RunnerTrustRepository;
const NO_POOLED = {
  find: vi.fn(async () => null),
} as unknown as PoolRunnerRepository;
const NOW = new Date('2026-01-02T03:04:05.000Z');

const stored = (...harnesses: string[]) =>
  Runner.rehydrate({
    id: ID,
    workspaceId: WorkspaceId.of('ws_1'),
    name: RunnerName.of('Laptop'),
    tokenHash: TokenHash.of('a'.repeat(64)),
    installed: harnesses.map((each) => InstalledHarness.reported(each, [])),
    revokedAt: null,
    lastSeenAt: null,
    version: 0,
  });

describe('RunnerPresence', () => {
  it('answers where the runner works and what it can run', async () => {
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () => stored('claude-code')),
        save: vi.fn(async () => {}),
      } as unknown as RunnerRepository,
      NO_TRUSTS,
      NO_POOLED,
    );

    const seen = await presence.seen(ID, NOW);

    expect(seen?.workspaceId.value).toBe('ws_1');
    expect(seen?.harnesses.map((each) => each.value)).toEqual(['claude-code']);
  });

  it('keeps harnesses reported while it was reading, rather than writing over them', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce(stored())
      .mockResolvedValueOnce(stored('claude-code'));
    const save = vi
      .fn()
      .mockRejectedValueOnce(new RunnerMovedOnError(ID.value))
      .mockResolvedValueOnce(undefined);

    const seen = await new RunnerPresence(
      {
        find,
        save,
      } as unknown as RunnerRepository,
      NO_TRUSTS,
      NO_POOLED,
    ).seen(ID, NOW);

    expect(save.mock.calls[1]?.[0]).toMatchObject({ lastSeenAt: NOW });
    expect(seen?.harnesses.map((each) => each.value)).toEqual(['claude-code']);
  });

  it('knows nothing of a runner never enrolled', async () => {
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () => null),
      } as unknown as RunnerRepository,
      NO_TRUSTS,
      NO_POOLED,
    );

    await expect(presence.seen(ID, NOW)).resolves.toBeNull();
  });

  it('answers to its name, its own labels and those of the trust it enrolled through', async () => {
    const trustId = RunnerTrustId.of('trust_1');
    const trusted = Runner.rehydrate({
      id: ID,
      workspaceId: WorkspaceId.of('ws_1'),
      name: RunnerName.of('pod-a'),
      tokenHash: TokenHash.of('a'.repeat(64)),
      labels: RunnerLabels.of(['gpu']),
      trustId,
      installed: [],
      revokedAt: null,
      lastSeenAt: null,
      version: 0,
    });
    const trust = RunnerTrust.rehydrate({
      id: trustId,
      workspaceId: WorkspaceId.of('ws_1'),
      key: TrustKey.of('production'),
      workload: TrustedWorkload.of({
        issuer: 'https://oidc.example.com',
        subject: 'runner',
        audience: 'spotlight',
      }),
      labels: RunnerLabels.of(['vpc-internal', 'gpu']),
      version: 0,
    });
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () => trusted),
        save: vi.fn(async () => {}),
      } as unknown as RunnerRepository,
      { find: vi.fn(async () => trust) } as unknown as RunnerTrustRepository,
      NO_POOLED,
    );

    expect((await presence.seen(ID, NOW))?.terms.values).toEqual([
      'pod-a',
      'gpu',
      'vpc-internal',
    ]);
  });

  it('knows nothing of a runner whose trust was withdrawn', async () => {
    const orphan = Runner.rehydrate({
      id: ID,
      workspaceId: WorkspaceId.of('ws_1'),
      name: RunnerName.of('pod-a'),
      tokenHash: TokenHash.of('a'.repeat(64)),
      trustId: RunnerTrustId.of('trust_gone'),
      installed: [],
      revokedAt: null,
      lastSeenAt: null,
      version: 0,
    });
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () => orphan),
        save: vi.fn(async () => {}),
      } as unknown as RunnerRepository,
      NO_TRUSTS,
      NO_POOLED,
    );

    await expect(presence.seen(ID, NOW)).resolves.toBeNull();
  });

  it('says a runner it cannot find, or that no longer stands, cannot be pinned to', async () => {
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () =>
          stored('claude-code').revoke(NOW, attributedIn()),
        ),
      } as unknown as RunnerRepository,
      NO_TRUSTS,
      NO_POOLED,
    );
    const absent = new RunnerPresence(
      { find: vi.fn(async () => null) } as unknown as RunnerRepository,
      NO_TRUSTS,
      NO_POOLED,
    );

    expect(await presence.pinnableTerms(ID)).toBeNull();
    expect(await absent.pinnableTerms(ID)).toBeNull();
  });

  it('says what a standing runner answers to, without marking it seen', async () => {
    const save = vi.fn();
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () => stored('claude-code')),
        save,
      } as unknown as RunnerRepository,
      NO_TRUSTS,
      NO_POOLED,
    );

    expect((await presence.pinnableTerms(ID))?.values).toEqual(['Laptop']);
    expect(save).not.toHaveBeenCalled();
  });

  describe('for a pool runner', () => {
    const pooled = (runner: PoolRunner | null) => {
      const save = vi.fn(async () => {});

      return {
        save,
        presence: new RunnerPresence(
          { find: vi.fn(async () => null) } as unknown as RunnerRepository,
          NO_TRUSTS,
          {
            find: vi.fn(async () => runner),
            save,
          } as unknown as PoolRunnerRepository,
        ),
      };
    };

    it('answers what it may claim, marking it seen', async () => {
      const { presence, save } = pooled(
        aPoolRunner({
          installed: [InstalledHarness.reported('claude-code', [], '2.1.0')],
        }),
      );

      const seen = await presence.seen(ID, STARTED_AT);

      expect(seen?.claims).toBe('reserved');
      expect(seen?.terms.values).toEqual(['linux', 'claude-code@2.1.0']);
      expect(save).toHaveBeenCalledOnce();
    });

    it('knows nothing of one that has ended', async () => {
      const { presence } = pooled(
        aPoolRunner().took(PoolWork.run('run_1'), STARTED_AT).ended(STARTED_AT),
      );

      await expect(presence.seen(ID, STARTED_AT)).resolves.toBeNull();
    });

    it('never pins a task to one, since it is gone with its run', async () => {
      const { presence } = pooled(aPoolRunner());

      await expect(presence.pinnableTerms(ID)).resolves.toBeNull();
    });
  });
});

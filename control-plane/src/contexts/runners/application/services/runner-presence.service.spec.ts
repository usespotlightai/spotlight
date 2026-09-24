import { RunnerPresence } from '@runners/application/services/runner-presence.service';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerMovedOnError } from '@runners/domain/exceptions/runner-moved-on.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
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
    );

    await expect(presence.seen(ID, NOW)).resolves.toBeNull();
  });

  it('says a runner it cannot find, or that no longer stands, answers to nothing', async () => {
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () =>
          stored('claude-code').revoke(NOW, attributedIn()),
        ),
      } as unknown as RunnerRepository,
      NO_TRUSTS,
    );
    const absent = new RunnerPresence(
      { find: vi.fn(async () => null) } as unknown as RunnerRepository,
      NO_TRUSTS,
    );

    expect((await presence.termsOf(ID)).values).toEqual([]);
    expect((await absent.termsOf(ID)).values).toEqual([]);
  });

  it('says what a standing runner answers to, without marking it seen', async () => {
    const save = vi.fn();
    const presence = new RunnerPresence(
      {
        find: vi.fn(async () => stored('claude-code')),
        save,
      } as unknown as RunnerRepository,
      NO_TRUSTS,
    );

    expect((await presence.termsOf(ID)).values).toEqual(['Laptop']);
    expect(save).not.toHaveBeenCalled();
  });
});

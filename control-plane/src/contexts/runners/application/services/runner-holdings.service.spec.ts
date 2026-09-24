import { RunnerHoldings } from '@runners/application/services/runner-holdings.service';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TRUST = RunnerTrustId.of('trust_1');

const runner = (name: string, trustId: RunnerTrustId | null) =>
  Runner.rehydrate({
    id: RunnerId.of(`runner_${name}`),
    workspaceId: WORKSPACE,
    name: RunnerName.of(name),
    tokenHash: TokenHash.of('a'.repeat(64)),
    trustId,
    installed: [],
    revokedAt: null,
    lastSeenAt: null,
    version: 0,
  });

const trust = RunnerTrust.rehydrate({
  id: TRUST,
  workspaceId: WORKSPACE,
  key: TrustKey.of('production'),
  workload: TrustedWorkload.of({
    issuer: 'https://oidc.example.com',
    subject: 'runner',
    audience: 'spotlight',
  }),
  labels: RunnerLabels.none(),
  version: 0,
});

const holdings = (declared: WorkspaceRunners | null) =>
  new RunnerHoldings(
    {
      standingIn: async () => [runner('build-1', null), runner('pod-a', TRUST)],
    } as unknown as RunnerRepository,
    { inWorkspace: async () => [trust] } as unknown as RunnerTrustRepository,
    {
      declaredIn: async () => declared,
    } as unknown as WorkspaceRunnersRepository,
  );

describe('RunnerHoldings', () => {
  it('holds a workspace by its hand-enrolled runners, its trusts and its declaration', async () => {
    const declared = WorkspaceRunners.rehydrate({
      id: WorkspaceRunnersId.of('declared_1'),
      workspaceId: WORKSPACE,
      runners: [],
      trusts: [],
      version: 0,
    });

    await expect(holdings(declared).heldBy(WORKSPACE)).resolves.toEqual([
      'runner build-1',
      'runner trust production',
      'workspace runners',
    ]);
  });

  it('leaves runners enrolled through a trust to the trust that holds them', async () => {
    await expect(holdings(null).heldBy(WORKSPACE)).resolves.not.toContain(
      'runner pod-a',
    );
  });
});

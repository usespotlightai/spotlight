import { RunnerHoldings } from '@runners/application/services/runner-holdings.service';
import { anEgress } from '@runners/domain/aggregates/egress.fake-spec';
import { aPullPool } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TRUST = RunnerTrustId.of('trust_1');

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
    { inWorkspace: async () => [trust] } as unknown as RunnerTrustRepository,
    {
      declaredIn: async () => declared,
    } as unknown as WorkspaceRunnersRepository,
    {
      inWorkspace: async () => [aPullPool()],
    } as unknown as RunnerPoolRepository,
    {
      inWorkspace: async () => [anEgress()],
    } as unknown as EgressRepository,
  );

describe('RunnerHoldings', () => {
  it('holds a workspace by its trusts, its pools, its egresses and its declaration', async () => {
    const declared = WorkspaceRunners.rehydrate({
      id: WorkspaceRunnersId.of('declared_1'),
      workspaceId: WORKSPACE,
      trusts: [],
      pools: [],
      version: 0,
    });

    await expect(holdings(declared).heldBy(WORKSPACE)).resolves.toEqual([
      'runner trust production',
      'runner pool ephemeral',
      'egress shared',
      'workspace runners',
    ]);
  });

  it('holds nothing for a declaration the workspace never made', async () => {
    await expect(holdings(null).heldBy(WORKSPACE)).resolves.toEqual([
      'runner trust production',
      'runner pool ephemeral',
      'egress shared',
    ]);
  });
});

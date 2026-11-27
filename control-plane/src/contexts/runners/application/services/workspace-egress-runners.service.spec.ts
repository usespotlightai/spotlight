import { WorkspaceEgressRunners } from '@runners/application/services/workspace-egress-runners.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPushPool,
  aTrust,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const POOL_WORKSPACE = WorkspaceId.of('ws_1');

const egressRunners = (
  stored: { pools?: RunnerPool[]; trusts?: RunnerTrust[] },
  platformEgressSet = true,
) =>
  new WorkspaceEgressRunners(
    {
      inWorkspace: async (id: WorkspaceId) =>
        id.equals(POOL_WORKSPACE) ? (stored.pools ?? []) : [],
    } as unknown as RunnerPoolRepository,
    {
      inWorkspace: async (id: WorkspaceId) =>
        id.equals(POOL_WORKSPACE) ? (stored.trusts ?? []) : [],
    } as unknown as RunnerTrustRepository,
    { platformPoolSet: true, platformEgressSet },
  );

describe('WorkspaceEgressRunners', () => {
  it('finds a runner with egress among the pools and trusts of the workspace alone', async () => {
    const trusted = egressRunners({ pools: [aPushPool()], trusts: [aTrust()] });

    expect(await trusted.anyIn(POOL_WORKSPACE.value)).toBe(true);
    expect(await trusted.anyIn('ws_other')).toBe(false);
    expect(
      await egressRunners({ pools: [aPushPool()] }).anyIn(POOL_WORKSPACE.value),
    ).toBe(false);
  });

  it('counts the Spotlight egress only while the deployment sets it', async () => {
    const pools = [aPushPool({ egress: EgressReference.platform() })];

    expect(await egressRunners({ pools }).anyIn(POOL_WORKSPACE.value)).toBe(
      true,
    );
    expect(
      await egressRunners({ pools }, false).anyIn(POOL_WORKSPACE.value),
    ).toBe(false);
  });
});

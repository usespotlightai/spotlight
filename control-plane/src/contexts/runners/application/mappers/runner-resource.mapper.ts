import type {
  RunnerPoolResourceDto,
  RunnerTrustResourceDto,
  WorkspaceRunnersResourceDto,
} from '@runners/application/dto/runner-resource.dto';
import type {
  ConfiguredRunnerPool,
  ConfiguredRunnerTrust,
  ConfiguredWorkspaceRunners,
} from '@runners/application/ports/runner-configuration.port';
import type {
  KeptPool,
  KeptTrust,
  KeptWorkspaceRunners,
} from '@runners/application/ports/runner-resources.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import {
  driftBetween,
  type WaysIn,
} from '@runners/domain/services/runner-drift';

export const RunnerResourceMapper = {
  trust(trust: KeptTrust): RunnerTrustResourceDto {
    return {
      id: trust.id,
      version: trust.version,
      address: trust.key,
      workspaceId: trust.workspaceId.value,
      key: trust.key,
      issuer: trust.issuer,
      subject: trust.subject,
      audience: trust.audience,
      labels: trust.labels,
      warnings: [],
    };
  },

  pool(pool: KeptPool): RunnerPoolResourceDto {
    return {
      id: pool.id,
      version: pool.version,
      address: pool.key,
      workspaceId: pool.workspaceId.value,
      key: pool.key,
      labels: pool.labels,
      maxRuns: pool.maxRuns,
      mode: pool.provision ? 'push' : 'pull',
      tokenVersion: pool.tokenVersion,
      provision: pool.provision,
      warnings:
        pool.provision && !/^https:/i.test(pool.provision.url)
          ? [RunnerProblems.provisionedInTheClear()]
          : [],
    };
  },

  configuredPool(pool: RunnerPool): ConfiguredRunnerPool {
    const { access } = pool;

    return {
      id: pool.id.value,
      address: pool.key.value,
      workspaceId: pool.workspaceId,
      key: pool.key.value,
      labels: pool.labels.values,
      maxRuns: pool.maxRuns?.value ?? null,
      tokenVersion: access.mode === 'pull' ? access.tokenVersion : null,
      provision:
        access.mode === 'push'
          ? { url: access.url.value, secretVersion: access.secretVersion }
          : null,
    };
  },

  configuredTrust(trust: RunnerTrust): ConfiguredRunnerTrust {
    return {
      id: trust.id.value,
      address: trust.key.value,
      workspaceId: trust.workspaceId,
      key: trust.key.value,
      issuer: trust.workload.issuer,
      subject: trust.workload.subject,
      audience: trust.workload.audience,
      labels: trust.labels.values,
    };
  },

  configuredDeclaration(
    declared: WorkspaceRunners,
    slug: string,
  ): ConfiguredWorkspaceRunners {
    return {
      id: declared.id.value,
      address: slug,
      workspaceId: declared.workspaceId,
      trusts: declared.trusts.map((each) => each.value),
      pools: declared.pools.map((each) => each.value),
    };
  },

  workspaceRunners(
    declared: KeptWorkspaceRunners,
    slug: string,
    waysIn: WaysIn,
  ): WorkspaceRunnersResourceDto {
    const drift = driftBetween(declared, waysIn);

    return {
      id: declared.id,
      version: declared.version,
      address: slug,
      workspaceId: declared.workspaceId.value,
      trusts: declared.trusts,
      pools: declared.pools,
      warnings: [
        ...declared.trusts.flatMap((key, at) =>
          drift.unknownTrusts.includes(key)
            ? [RunnerProblems.noSuchTrust(key, at)]
            : [],
        ),
        ...declared.pools.flatMap((key, at) =>
          drift.unknownPools.includes(key)
            ? [RunnerProblems.noSuchPool(key, at)]
            : [],
        ),
      ],
    };
  },
};

import type {
  EgressResourceDto,
  RunnerPoolResourceDto,
  RunnerTrustResourceDto,
  WorkspaceRunnersResourceDto,
} from '@runners/application/dto/runner-resource.dto';
import type {
  EgressView,
  RunnerPoolView,
  RunnerTrustView,
  WorkspaceRunnersView,
} from '@runners/application/ports/runner-configuration.port';
import type {
  EgressRecord,
  RunnerPoolRecord,
  RunnerTrustRecord,
  WorkspaceRunnersRecord,
} from '@runners/application/ports/runner-resources.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import {
  driftBetween,
  type WaysIn,
} from '@runners/domain/services/runner-drift';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';

export const RunnerResourceMapper = {
  trust(trust: RunnerTrustRecord): RunnerTrustResourceDto {
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

  pool(pool: RunnerPoolRecord): RunnerPoolResourceDto {
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
        pool.provision && !ProvisionUrl.of(pool.provision.url).isSecure
          ? [RunnerProblems.provisionedInTheClear()]
          : [],
    };
  },

  configuredPool(pool: RunnerPool): RunnerPoolView {
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
          ? {
              url: access.url.value,
              secretVersion: access.secretVersion,
              egress: access.egress?.value ?? null,
              egressTraffic: access.egressTraffic.value,
            }
          : null,
    };
  },

  egress(egress: EgressRecord): EgressResourceDto {
    return {
      id: egress.id,
      version: egress.version,
      address: egress.key,
      workspaceId: egress.workspaceId.value,
      key: egress.key,
      url: egress.url,
      tokenVersion: egress.tokenVersion,
      warnings: EgressUrl.of(egress.url).isSecure
        ? []
        : [RunnerProblems.egressInTheClear()],
    };
  },

  configuredEgress(egress: Egress): EgressView {
    return {
      id: egress.id.value,
      address: egress.key.value,
      workspaceId: egress.workspaceId,
      key: egress.key.value,
      url: egress.url.value,
      tokenVersion: egress.tokenVersion,
    };
  },

  configuredTrust(trust: RunnerTrust): RunnerTrustView {
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
  ): WorkspaceRunnersView {
    return {
      id: declared.id.value,
      address: slug,
      workspaceId: declared.workspaceId,
      trusts: declared.trusts.map((each) => each.value),
      pools: declared.pools.map((each) => each.value),
    };
  },

  workspaceRunners(
    declared: WorkspaceRunnersRecord,
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

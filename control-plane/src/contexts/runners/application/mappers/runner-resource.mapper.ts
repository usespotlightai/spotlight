import type {
  EgressResourceDto,
  RunnerPoolResourceDto,
  RunnerTrustResourceDto,
  WorkspaceRunnersResourceDto,
} from '@runners/application/dto/runner-resource.dto';
import { workingCopyStoreContract } from '@runners/application/mappers/working-copy-store.mapper';
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
  type CredentialSourceKeys,
  danglingKeysBetween,
} from '@runners/domain/services/dangling-keys';
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
      workingCopies: trust.workingCopies,
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
      workingCopies: pool.workingCopies,
      warnings:
        pool.provision && !ProvisionUrl.of(pool.provision.url).isSecure
          ? [RunnerProblems.provisionNotHttps()]
          : [],
    };
  },

  configuredPool(pool: RunnerPool): RunnerPoolView {
    const { access, provision } = pool;

    return {
      id: pool.id.value,
      address: pool.key.value,
      workspaceId: pool.workspaceId,
      key: pool.key.value,
      labels: pool.labels.values,
      maxRuns: pool.maxRuns?.value ?? null,
      tokenVersion: access.kind === 'pull' ? access.tokenVersion.value : null,
      provision: provision
        ? {
            url: provision.url.value,
            secretVersion: provision.secretVersion.value,
            egress: provision.egress?.value ?? null,
            egressTraffic: provision.egressTraffic.value,
          }
        : null,
      workingCopies: workingCopyStoreContract(pool.workingCopies),
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
        : [RunnerProblems.egressNotHttps()],
    };
  },

  configuredEgress(egress: Egress): EgressView {
    return {
      id: egress.id.value,
      address: egress.key.value,
      workspaceId: egress.workspaceId,
      key: egress.key.value,
      url: egress.url.value,
      tokenVersion: egress.tokenVersion.value,
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
      workingCopies: workingCopyStoreContract(trust.workingCopies),
    };
  },

  configuredWorkspaceRunners(
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
    existing: CredentialSourceKeys,
  ): WorkspaceRunnersResourceDto {
    const dangling = danglingKeysBetween(declared, existing);

    return {
      id: declared.id,
      version: declared.version,
      address: slug,
      workspaceId: declared.workspaceId.value,
      trusts: declared.trusts,
      pools: declared.pools,
      warnings: [
        ...declared.trusts.flatMap((key, at) =>
          dangling.unknownTrusts.includes(key)
            ? [RunnerProblems.noSuchTrust(key, at)]
            : [],
        ),
        ...declared.pools.flatMap((key, at) =>
          dangling.unknownPools.includes(key)
            ? [RunnerProblems.noSuchPool(key, at)]
            : [],
        ),
      ],
    };
  },
};

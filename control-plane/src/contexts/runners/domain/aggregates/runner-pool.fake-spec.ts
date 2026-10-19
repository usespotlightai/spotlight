import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerHostVersionConflictError } from '@runners/domain/exceptions/runner-host-version-conflict.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import type { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

export const POOL_ID = RunnerPoolId.of('pool_1');

export const TRUST_ID = RunnerTrustId.of('trust_1');

const POOL_WORKSPACE = WorkspaceId.of('ws_1');

export const HOST_ID = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

export const STARTED_AT = new Date('2026-09-24T10:00:00.000Z');

export const hashOf = (character: string): TokenHash =>
  TokenHash.of(character.repeat(64));

export const secretOf = (character: string): ProvisionSecret =>
  ProvisionSecret.of(
    `whsec_${Buffer.from(character.repeat(32)).toString('base64')}`,
  );

export const aPullPool = (
  input: {
    id?: RunnerPoolId;
    maxRuns?: number;
    labels?: string[];
    tokenVersion?: number;
  } = {},
): RunnerPool =>
  RunnerPool.create({
    id: input.id ?? POOL_ID,
    workspaceId: POOL_WORKSPACE,
    key: PoolKey.of('ephemeral'),
    labels: RunnerLabels.of(input.labels ?? ['linux']),
    maxRuns: input.maxRuns ? MaxRuns.of(input.maxRuns) : null,
    access: {
      mode: 'pull',
      tokenHash: hashOf('a'),
      tokenVersion: input.tokenVersion ?? null,
    },
    by: changeActorIn(),
  });

export const encryptedOf = (character: string): EncryptedProvisionSecret =>
  EncryptedProvisionSecret.of(`encrypted:${character}`);

export const aPushPool = (
  input: {
    maxRuns?: number;
    labels?: string[];
    url?: string;
    egress?: EgressReference | null;
    egressTraffic?: EgressTraffic;
  } = {},
): RunnerPool =>
  RunnerPool.create({
    id: POOL_ID,
    workspaceId: POOL_WORKSPACE,
    key: PoolKey.of('sandboxes'),
    labels: RunnerLabels.of(input.labels ?? ['sandbox']),
    maxRuns: input.maxRuns ? MaxRuns.of(input.maxRuns) : null,
    access: {
      mode: 'push',
      url: ProvisionUrl.of(input.url ?? 'https://provision.example.com/runs'),
      secret: encryptedOf('s'),
      secretVersion: 1,
      egress: input.egress ?? null,
      egressTraffic: input.egressTraffic,
    },
    by: changeActorIn(),
  });

export const aTrust = (input: { labels?: string[] } = {}): RunnerTrust =>
  RunnerTrust.create({
    id: TRUST_ID,
    workspaceId: POOL_WORKSPACE,
    key: TrustKey.of('cluster'),
    workload: TrustedWorkload.of({
      issuer: 'https://oidc.example.com/cluster',
      subject: 'system:serviceaccount:spotlight:runner',
      audience: 'spotlight',
    }),
    labels: RunnerLabels.of(input.labels ?? ['vpc-internal']),
    by: changeActorIn(),
  });

export const aRunner = (
  input: {
    through?: RunnerPool | RunnerTrust;
    host?: string | null;
    id?: string;
    installed?: readonly InstalledHarness[];
    running?: RunningImage | null;
    claimWithinMs?: number;
    proxyCredentialHash?: TokenHash | null;
  } = {},
): Runner =>
  Runner.start({
    id: RunnerId.of(input.id ?? 'pooled_1'),
    through: input.through ?? aPullPool(),
    host: input.host === null ? null : HostId.of(input.host ?? HOST_ID.value),
    tokenHash: hashOf('b'),
    egressTokenHash: input.host === null ? null : hashOf('e'),
    proxyCredentialHash: input.proxyCredentialHash ?? null,
    installed: input.installed ?? [],
    running: input.running ?? null,
    at: STARTED_AT,
    claimBy: new Date(STARTED_AT.getTime() + (input.claimWithinMs ?? 60_000)),
  });

export const aHostReport = (
  running: string[] = [],
  release = '0.9.0',
): HostReport =>
  HostReport.of({
    name: 'build-box',
    release,
    containerRuntime: 'docker',
    capacity: 4,
    running,
    images: [
      {
        image: 'ghcr.io/acme/runner:main',
        isDefault: true,
        harnesses: [{ id: 'claude-code', models: [], version: '2.1.0' }],
      },
      { image: 'ghcr.io/acme/widgets:1', isDefault: false, harnesses: [] },
      {
        image: 'ghcr.io/acme/old:1',
        isDefault: false,
        harnesses: [],
        unavailableReason:
          "Runner doesn't report its release number. Minimum version required: v0.3.0",
      },
    ],
  });

export const aHost = (
  input: {
    through?: RunnerPool | RunnerTrust;
    id?: HostId;
    at?: Date;
    release?: string;
  } = {},
): RunnerHost => {
  const through = input.through ?? aPullPool();

  return RunnerHost.fromHeartbeat({
    id: input.id ?? HOST_ID,
    workspaceId: through.workspaceId,
    source: CredentialSource.ofId(through.id),
    bootId: BootId.of('boot_1'),
    report: aHostReport([], input.release),
    at: input.at ?? STARTED_AT,
  });
};

export const storedHosts = (...known: RunnerHost[]) => {
  const stored = new Map(known.map((host) => [host.id.value, host]));
  const hosts = {
    find: vi.fn(async (id: HostId) => stored.get(id.value) ?? null),
    add: vi.fn(async (host: RunnerHost) => {
      if (stored.has(host.id.value)) {
        throw new RunnerHostVersionConflictError(host.id.value);
      }
      stored.set(host.id.value, host);
    }),
    save: vi.fn(async (host: RunnerHost) => {
      if (stored.get(host.id.value)?.version !== host.version) {
        throw new RunnerHostVersionConflictError(host.id.value);
      }
      stored.set(
        host.id.value,
        RunnerHost.rehydrate({
          id: host.id,
          workspaceId: host.workspaceId,
          source: host.source,
          bootId: host.bootId,
          report: host.report,
          firstHeartbeatAt: host.firstHeartbeatAt,
          onlineSince: host.onlineSince,
          lastHeartbeatAt: host.lastHeartbeatAt,
          version: host.version + 1,
        }),
      );
    }),
    remove: vi.fn(async (host: RunnerHost) => {
      if (stored.get(host.id.value)?.version !== host.version) {
        throw new RunnerHostVersionConflictError(host.id.value);
      }
      stored.delete(host.id.value);
    }),
    removeStaleBefore: vi.fn(async (cutoff: Date) => {
      let removed = 0;
      for (const [id, host] of stored) {
        if (host.lastHeartbeatAt <= cutoff) {
          stored.delete(id);
          removed++;
        }
      }
      return removed;
    }),
    removeThrough: vi.fn(async (source: CredentialSource) => {
      for (const [id, host] of stored) {
        if (host.hasSource(source)) {
          stored.delete(id);
        }
      }
    }),
  } satisfies RunnerHostRepository;

  return { stored, hosts };
};

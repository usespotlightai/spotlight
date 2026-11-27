import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
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
import {
  type PlatformPoolAllowances,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RotationVersion } from '@runners/domain/value-objects/rotation-version.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { SandboxReport } from '@runners/domain/value-objects/sandbox-report.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { SigningSecret } from '@shared-kernel/domain/value-objects/signing-secret.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { type Mocked, vi } from 'vitest';

export const POOL_ID = PoolId.of('pool_1');

export const TRUST_ID = RunnerTrustId.of('trust_1');

const POOL_WORKSPACE = WorkspaceId.of('ws_1');

export const HOST_ID = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

export const STARTED_AT = new Date('2026-09-24T10:00:00.000Z');

export const hashOf = (character: string): TokenHash =>
  TokenHash.of(character.repeat(64));

export const secretOf = (character: string): SigningSecret =>
  SigningSecret.of(
    `whsec_${Buffer.from(character.repeat(32)).toString('base64')}`,
  );

export const aPullPool = (
  input: {
    id?: PoolId;
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
    maxRuns:
      input.maxRuns !== undefined && input.maxRuns !== 0
        ? MaxRuns.of(input.maxRuns)
        : null,
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
    key?: string;
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
    key: PoolKey.of(input.key ?? 'sandboxes'),
    labels: RunnerLabels.of(input.labels ?? ['sandbox']),
    maxRuns:
      input.maxRuns !== undefined && input.maxRuns !== 0
        ? MaxRuns.of(input.maxRuns)
        : null,
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

const PLATFORM_POOL_ID = PoolId.of('pool_platform');

export const aPlatformPool = (
  input: {
    labels?: string[];
    egress?: EgressReference | null;
    disabled?: boolean;
    workspaceId?: WorkspaceId;
    allows?: PlatformPoolAllowances;
  } = {},
): RunnerPool => {
  const created = RunnerPool.createPlatform({
    id: PLATFORM_POOL_ID,
    workspaceId: input.workspaceId ?? POOL_WORKSPACE,
    labels: RunnerLabels.of(input.labels ?? []),
    egress: input.egress ?? null,
    by: changeActorIn(),
  });

  return input.disabled === true || input.allows !== undefined
    ? created.configure(
        {
          ...input.allows,
          ...(input.disabled === true ? { enabled: false } : {}),
        },
        changeActorIn(),
      )
    : created;
};

// A pool of the workspace that took the platform key before Spotlight kept that key for the platform pool.
export const anOwnPoolWithThePlatformKey = (): RunnerPool =>
  RunnerPool.rehydrate({
    id: POOL_ID,
    workspaceId: POOL_WORKSPACE,
    key: PoolKey.platform(),
    labels: RunnerLabels.of(['sandbox']),
    maxRuns: null,
    access: PushAccess.of(
      ProvisionUrl.of('https://provision.example.com/runs'),
      encryptedOf('s'),
      RotationVersion.of(1),
      null,
    ),
    version: 0,
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
    enters?: string;
  } = {},
): Runner =>
  Runner.start({
    id: RunnerId.of(input.id ?? 'pooled_1'),
    through: input.through ?? aPullPool(),
    host: input.host === null ? null : HostId.of(input.host ?? HOST_ID.value),
    enters:
      input.enters !== undefined && input.enters !== ''
        ? SandboxId.of(input.enters)
        : null,
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

export const aSandboxReport = (
  sandboxes: string[] = [],
  stopping = false,
): SandboxReport => SandboxReport.of({ sandboxes, stopping });

export const aHost = (
  input: {
    through?: RunnerPool | RunnerTrust;
    id?: HostId;
    at?: Date;
    release?: string;
    sandboxes?: string[];
    stopping?: boolean;
  } = {},
): RunnerHost => {
  const through = input.through ?? aPullPool();

  return RunnerHost.fromHeartbeat({
    id: input.id ?? HOST_ID,
    workspaceId: through.workspaceId,
    source: CredentialSource.ofId(through.id),
    bootId: BootId.of('boot_1'),
    report: aHostReport([], input.release),
    sandboxes: aSandboxReport(input.sandboxes, input.stopping),
    at: input.at ?? STARTED_AT,
  });
};

interface StoredHosts {
  readonly stored: Map<string, RunnerHost>;
  readonly hosts: Mocked<RunnerHostRepository>;
}

export const storedHosts = (...known: RunnerHost[]): StoredHosts => {
  const stored = new Map(known.map((host) => [host.id.value, host]));
  const hosts = {
    find: vi.fn((id: HostId) => Promise.resolve(stored.get(id.value) ?? null)),
    add: vi.fn((host: RunnerHost) => {
      if (stored.has(host.id.value)) {
        return Promise.reject(
          new RunnerHostVersionConflictError(host.id.value),
        );
      }
      stored.set(host.id.value, host);
      return Promise.resolve();
    }),
    save: vi.fn((host: RunnerHost) => {
      if (stored.get(host.id.value)?.version !== host.version) {
        return Promise.reject(
          new RunnerHostVersionConflictError(host.id.value),
        );
      }
      stored.set(
        host.id.value,
        RunnerHost.rehydrate({
          id: host.id,
          workspaceId: host.workspaceId,
          source: host.source,
          bootId: host.bootId,
          report: host.report,
          sandboxes: host.sandboxes,
          firstHeartbeatAt: host.firstHeartbeatAt,
          onlineSince: host.onlineSince,
          lastHeartbeatAt: host.lastHeartbeatAt,
          version: host.version + 1,
        }),
      );
      return Promise.resolve();
    }),
    remove: vi.fn((host: RunnerHost) => {
      if (stored.get(host.id.value)?.version !== host.version) {
        return Promise.reject(
          new RunnerHostVersionConflictError(host.id.value),
        );
      }
      stored.delete(host.id.value);
      return Promise.resolve();
    }),
    silentSince: vi.fn((cutoff: Date) =>
      Promise.resolve(
        [...stored.values()].filter((host) => host.lastHeartbeatAt <= cutoff),
      ),
    ),
    servingThrough: vi.fn((source: CredentialSource) =>
      Promise.resolve(
        [...stored.values()].filter((host) => host.hasSource(source)),
      ),
    ),
    inWorkspace: vi.fn((workspaceId: WorkspaceId) =>
      Promise.resolve(
        [...stored.values()].filter((host) => host.belongsTo(workspaceId)),
      ),
    ),
  } satisfies RunnerHostRepository;

  return { stored, hosts };
};

import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerHostMovedOnError } from '@runners/domain/exceptions/runner-host-moved-on.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
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
import { SealedProvisionSecret } from '@runners/domain/value-objects/sealed-provision-secret.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
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
  RunnerPool.define({
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
    by: attributedIn(),
  });

export const sealedOf = (character: string): SealedProvisionSecret =>
  SealedProvisionSecret.of(`sealed:${character}`);

export const aPushPool = (
  input: { maxRuns?: number; labels?: string[]; url?: string } = {},
): RunnerPool =>
  RunnerPool.define({
    id: POOL_ID,
    workspaceId: POOL_WORKSPACE,
    key: PoolKey.of('sandboxes'),
    labels: RunnerLabels.of(input.labels ?? ['sandbox']),
    maxRuns: input.maxRuns ? MaxRuns.of(input.maxRuns) : null,
    access: {
      mode: 'push',
      url: ProvisionUrl.of(input.url ?? 'https://provision.example.com/runs'),
      secret: sealedOf('s'),
      secretVersion: 1,
    },
    by: attributedIn(),
  });

export const aTrust = (input: { labels?: string[] } = {}): RunnerTrust =>
  RunnerTrust.define({
    id: TRUST_ID,
    workspaceId: POOL_WORKSPACE,
    key: TrustKey.of('cluster'),
    workload: TrustedWorkload.of({
      issuer: 'https://oidc.example.com/cluster',
      subject: 'system:serviceaccount:spotlight:runner',
      audience: 'spotlight',
    }),
    labels: RunnerLabels.of(input.labels ?? ['vpc-internal']),
    by: attributedIn(),
  });

export const aRunner = (
  input: {
    through?: RunnerPool | RunnerTrust;
    host?: string | null;
    id?: string;
    installed?: readonly InstalledHarness[];
    running?: RunningImage | null;
    claimWithinMs?: number;
  } = {},
): Runner =>
  Runner.started({
    id: RunnerId.of(input.id ?? 'pooled_1'),
    through: input.through ?? aPullPool(),
    host: input.host === null ? null : HostId.of(input.host ?? HOST_ID.value),
    tokenHash: hashOf('b'),
    egressTokenHash: input.host === null ? null : hashOf('e'),
    installed: input.installed ?? [],
    running: input.running ?? null,
    at: STARTED_AT,
    claimBy: new Date(STARTED_AT.getTime() + (input.claimWithinMs ?? 60_000)),
  });

export const aHostReport = (running: string[] = []): HostReport =>
  HostReport.of({
    name: 'build-box',
    release: '0.9.0',
    executor: 'docker',
    capacity: 4,
    running,
    images: [
      {
        image: 'ghcr.io/acme/runner:main',
        usual: true,
        harnesses: [{ id: 'claude-code', models: [], version: '2.1.0' }],
      },
      { image: 'ghcr.io/acme/widgets:1', usual: false, harnesses: [] },
      {
        image: 'ghcr.io/acme/old:1',
        usual: false,
        harnesses: [],
        refused: 'its runner reports no release',
      },
    ],
  });

export const aHost = (
  input: { through?: RunnerPool | RunnerTrust; id?: HostId; at?: Date } = {},
): RunnerHost => {
  const through = input.through ?? aPullPool();

  return RunnerHost.present({
    id: input.id ?? HOST_ID,
    workspaceId: through.workspaceId,
    admission: Admission.through(through.id),
    report: aHostReport(),
    at: input.at ?? STARTED_AT,
  });
};

export const heldHosts = (...known: RunnerHost[]) => {
  const held = new Map(known.map((host) => [host.id.value, host]));
  const hosts = {
    find: vi.fn(async (id: HostId) => held.get(id.value) ?? null),
    add: vi.fn(async (host: RunnerHost) => {
      if (held.has(host.id.value)) {
        throw new RunnerHostMovedOnError(host.id.value);
      }
      held.set(host.id.value, host);
    }),
    save: vi.fn(async (host: RunnerHost) => {
      if (held.get(host.id.value)?.version !== host.version) {
        throw new RunnerHostMovedOnError(host.id.value);
      }
      held.set(
        host.id.value,
        RunnerHost.rehydrate({
          id: host.id,
          workspaceId: host.workspaceId,
          admission: host.admission,
          report: host.report,
          firstSeenAt: host.firstSeenAt,
          lastSeenAt: host.lastSeenAt,
          version: host.version + 1,
        }),
      );
    }),
    remove: vi.fn(async (host: RunnerHost) => {
      if (held.get(host.id.value)?.version !== host.version) {
        throw new RunnerHostMovedOnError(host.id.value);
      }
      held.delete(host.id.value);
    }),
    removeUnseenSince: vi.fn(async (since: Date) => {
      let removed = 0;
      for (const [id, host] of held) {
        if (host.lastSeenAt <= since) {
          held.delete(id);
          removed++;
        }
      }
      return removed;
    }),
    removeThrough: vi.fn(async (admission: Admission) => {
      for (const [id, host] of held) {
        if (host.servesThrough(admission)) {
          held.delete(id);
        }
      }
    }),
  } satisfies RunnerHostRepository;

  return { held, hosts };
};

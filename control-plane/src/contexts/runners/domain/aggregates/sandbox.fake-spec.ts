import { createHash } from 'node:crypto';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import {
  aHostReport,
  aSandboxReport,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxKeyTakenError } from '@runners/domain/exceptions/sandbox-key-taken.error';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

export const GRACE_MS = 10 * 60_000;

export const EDITOR_LIMIT_MS = 12 * 60 * 60_000;

export const tokenHashOf = (token: string): TokenHash =>
  TokenHash.of(createHash('sha256').update(token).digest('hex'));

export const sandboxTokens = (): TokenIssuer => {
  let issued = 0;

  return {
    issue: () => {
      const token = `sandbox-token-${++issued}`;
      return { token, hash: tokenHashOf(token).value };
    },
    hash: (token: string) => tokenHashOf(token).value,
  };
};

export const WARM_AGE_MS = 24 * 60 * 60_000;

export const DRAIN_POLICY = SandboxDrainPolicy.of({
  graceMs: GRACE_MS,
  editorLimitMs: EDITOR_LIMIT_MS,
  warmAgeMs: WARM_AGE_MS,
});

const savedAs = (sandbox: Sandbox, version: number): Sandbox =>
  Sandbox.rehydrate({
    id: sandbox.id,
    workspaceId: sandbox.workspaceId,
    key: sandbox.key,
    hostId: sandbox.hostId,
    source: sandbox.source,
    tokenHash: sandbox.tokenHash,
    state: sandbox.current,
    leases: sandbox.leases,
    idleSince: sandbox.idleSince,
    startedAt: sandbox.startedAt,
    goneAt: sandbox.goneAt,
    warm: sandbox.warm,
    version,
  });

export const SANDBOX_POOL = CredentialSource.ofId(PoolId.of('pool_1'));

export const aSandbox = (input: {
  id?: string;
  workspaceId: WorkspaceId;
  key?: string | null;
  hostId: HostId;
  source?: CredentialSource;
  runId?: string;
  at: Date;
}): Sandbox =>
  Sandbox.startForRun({
    id: SandboxId.of(input.id ?? 'sandbox_1'),
    workspaceId: input.workspaceId,
    key: input.key === null ? null : SandboxKey.of(input.key ?? 'task-task_1'),
    host: RunnerHost.fromHeartbeat({
      id: input.hostId,
      workspaceId: input.workspaceId,
      source: input.source ?? SANDBOX_POOL,
      bootId: BootId.of('boot_1'),
      report: aHostReport(),
      sandboxes: aSandboxReport(),
      at: input.at,
    }),
    tokenHash: tokenHashOf(input.id ?? 'sandbox_1'),
    runId: RunId.of(input.runId ?? 'run_1'),
    at: input.at,
  });

export const storedSandboxes = (
  input: {
    silentHosts?: () => readonly string[];
  } = {},
  ...known: Sandbox[]
) => {
  const stored = new Map(known.map((each) => [each.id.value, each]));
  const all = () => [...stored.values()];

  const sandboxes = {
    add: vi.fn(async (added: Sandbox) => {
      const keyTaken =
        added.key !== null &&
        all().some(
          (each) =>
            each.isOpen &&
            each.workspaceId.equals(added.workspaceId) &&
            each.key?.equals(added.key as SandboxKey),
        );

      if (stored.has(added.id.value) || keyTaken) {
        throw new SandboxVersionConflictError(added.id.value);
      }
      stored.set(added.id.value, added);
    }),
    save: vi.fn(async (saved: Sandbox) => {
      if (stored.get(saved.id.value)?.version !== saved.version) {
        throw new SandboxVersionConflictError(saved.id.value);
      }
      if (
        saved.isOpen &&
        saved.key !== null &&
        all().some(
          (each) =>
            !each.id.equals(saved.id) &&
            each.isOpen &&
            each.workspaceId.equals(saved.workspaceId) &&
            each.key?.equals(saved.key as SandboxKey),
        )
      ) {
        throw new SandboxKeyTakenError(saved.id.value);
      }
      stored.set(saved.id.value, savedAs(saved, saved.version + 1));
    }),
    find: vi.fn(async (id: SandboxId) => stored.get(id.value) ?? null),
    openFor: vi.fn(
      async (workspaceId: WorkspaceId, key: SandboxKey) =>
        all().find(
          (each) =>
            each.isOpen &&
            each.workspaceId.equals(workspaceId) &&
            each.key?.equals(key),
        ) ?? null,
    ),
    liveByTokenHash: vi.fn(
      async (hash: TokenHash) =>
        all().find(
          (each) => each.isLive && each.tokenHash?.equals(hash) === true,
        ) ?? null,
    ),
    requestedIn: vi.fn(async (workspaceId: WorkspaceId, limit: number) =>
      all()
        .filter(
          (each) =>
            each.isRequested &&
            each.key !== null &&
            each.workspaceId.equals(workspaceId),
        )
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .slice(0, limit),
    ),
    liveOn: vi.fn(async (hostId: HostId) =>
      all().filter(
        (each) => each.isLive && each.hostId?.equals(hostId) === true,
      ),
    ),
    liveIn: vi.fn(async (workspaceId: WorkspaceId) =>
      all().filter(
        (each) => each.isLive && each.workspaceId.equals(workspaceId),
      ),
    ),
    openWarm: vi.fn(async () => all().filter((each) => each.isWarm)),
    openWarmIn: vi.fn(async (workspaceId: WorkspaceId) =>
      all().filter(
        (each) => each.isWarm && each.workspaceId.equals(workspaceId),
      ),
    ),
    lostWarmSince: vi.fn(async (cutoff: Date) =>
      all().filter(
        (each) =>
          each.lostWhileWarm && each.goneAt !== null && each.goneAt >= cutoff,
      ),
    ),
    holdingRun: vi.fn(async (runId: RunId) =>
      all().filter((each) => each.isLive && each.holdsRun(runId)),
    ),
    idleSince: vi.fn(async (cutoff: Date) =>
      all().filter(
        (each) =>
          each.isOpen && each.idleSince !== null && each.idleSince <= cutoff,
      ),
    ),
    goneBefore: vi.fn(async (cutoff: Date) =>
      all().filter((each) => each.goneAt !== null && each.goneAt <= cutoff),
    ),
    remove: vi.fn(async (removed: Sandbox) => {
      if (stored.get(removed.id.value)?.version !== removed.version) {
        throw new SandboxVersionConflictError(removed.id.value);
      }
      stored.delete(removed.id.value);
    }),
  } satisfies SandboxRepository;

  const placements = {
    idleInPool: vi.fn(async (poolId: PoolId) =>
      all()
        .filter(
          (each) =>
            each.isLive &&
            each.isIdle &&
            each.source?.poolId?.equals(poolId) === true,
        )
        .map((each) => each.id),
    ),
    unreportedStartedBefore: vi.fn(async (cutoff: Date) =>
      all()
        .filter(
          (each) => each.isLive && each.isPlaced && each.startedAt <= cutoff,
        )
        .map((each) => each.id),
    ),
    liveOnHostsSilentSince: vi.fn(async () => {
      const silent = input.silentHosts?.() ?? [];
      return all()
        .filter(
          (each) =>
            each.isLive &&
            each.hostId !== null &&
            silent.includes(each.hostId.value),
        )
        .map((each) => each.id);
    }),
  } satisfies SandboxPlacementsPort;

  return { stored, sandboxes, placements };
};

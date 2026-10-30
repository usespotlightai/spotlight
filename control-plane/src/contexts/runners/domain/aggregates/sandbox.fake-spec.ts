import { createHash } from 'node:crypto';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
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

export const DRAIN_POLICY = SandboxDrainPolicy.of({
  graceMs: GRACE_MS,
  editorLimitMs: EDITOR_LIMIT_MS,
});

const savedAs = (sandbox: Sandbox, version: number): Sandbox =>
  Sandbox.rehydrate({
    id: sandbox.id,
    workspaceId: sandbox.workspaceId,
    key: sandbox.key,
    hostId: sandbox.hostId,
    tokenHash: sandbox.tokenHash,
    state: sandbox.current,
    leases: sandbox.leases,
    idleSince: sandbox.idleSince,
    startedAt: sandbox.startedAt,
    goneAt: sandbox.goneAt,
    version,
  });

export const aSandbox = (input: {
  id?: string;
  workspaceId: WorkspaceId;
  key?: string | null;
  hostId: HostId;
  runId?: string;
  at: Date;
}): Sandbox =>
  Sandbox.startForRun({
    id: SandboxId.of(input.id ?? 'sandbox_1'),
    workspaceId: input.workspaceId,
    key: input.key === null ? null : SandboxKey.of(input.key ?? 'task-task_1'),
    hostId: input.hostId,
    tokenHash: tokenHashOf(input.id ?? 'sandbox_1'),
    runId: input.runId ?? 'run_1',
    at: input.at,
  });

export const storedSandboxes = (
  input: {
    silentHosts?: () => readonly string[];
    poolOf?: (hostId: string) => string | null;
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
          (each) => each.isRequested && each.workspaceId.equals(workspaceId),
        )
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .slice(0, limit),
    ),
    liveOn: vi.fn(async (hostId: HostId) =>
      all().filter(
        (each) => each.isLive && each.hostId?.equals(hostId) === true,
      ),
    ),
    liveKeysIn: vi.fn(async (workspaceId: WorkspaceId) => {
      const silent = input.silentHosts?.() ?? [];
      return all().flatMap((each) =>
        each.isLive &&
        each.isPlaced &&
        each.key !== null &&
        each.workspaceId.equals(workspaceId) &&
        !silent.includes(each.hostId?.value ?? '')
          ? [each.key]
          : [],
      );
    }),
    idleInPool: vi.fn(
      async (poolId: RunnerPoolId) =>
        all().filter(
          (each) =>
            each.isLive &&
            each.isIdle &&
            each.hostId !== null &&
            input.poolOf?.(each.hostId.value) === poolId.value,
        ).length,
    ),
    holdingRun: vi.fn(async (runId: string) =>
      all().filter((each) => each.isLive && each.holdsRun(runId)),
    ),
    idleSince: vi.fn(async (cutoff: Date) =>
      all().filter(
        (each) =>
          each.isOpen && each.idleSince !== null && each.idleSince <= cutoff,
      ),
    ),
    liveOnHostsSilentSince: vi.fn(async () => {
      const silent = input.silentHosts?.() ?? [];
      return all().filter(
        (each) =>
          each.isLive &&
          each.hostId !== null &&
          silent.includes(each.hostId.value),
      );
    }),
    removeGoneBefore: vi.fn(async (cutoff: Date) => {
      let removed = 0;
      for (const [id, each] of stored) {
        if (each.goneAt !== null && each.goneAt <= cutoff) {
          stored.delete(id);
          removed++;
        }
      }
      return removed;
    }),
  } satisfies SandboxRepository;

  return { stored, sandboxes };
};

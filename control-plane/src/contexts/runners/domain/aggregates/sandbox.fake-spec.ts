import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

export const GRACE_MS = 10 * 60_000;

export const EDITOR_LIMIT_MS = 12 * 60 * 60_000;

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
    runId: input.runId ?? 'run_1',
    at: input.at,
  });

export const storedSandboxes = (
  input: { silentHosts?: () => readonly string[] } = {},
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
    liveOn: vi.fn(async (hostId: HostId) =>
      all().filter((each) => each.isLive && each.hostId.equals(hostId)),
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
        (each) => each.isLive && silent.includes(each.hostId.value),
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

import { Sandboxes } from '@runners/application/services/sandboxes.service';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  DRAIN_POLICY,
  GRACE_MS,
  storedSandboxes,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const STARTED_AT = new Date('2026-10-30T10:00:00.000Z');

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCDE';

const OTHER_HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCDF';

const WORKSPACE = WorkspaceId.of('ws_1');

const placed = (
  id: string,
  input: { key?: string | null; runId?: string; host?: string } = {},
) =>
  aSandbox({
    id,
    workspaceId: WORKSPACE,
    key: input.key,
    hostId: HostId.of(input.host ?? HOST),
    runId: input.runId,
    at: STARTED_AT,
  });

const serving = (input: { known?: Sandbox[]; silentHosts?: string[] } = {}) => {
  const { stored, sandboxes } = storedSandboxes(
    { silentHosts: () => input.silentHosts ?? [] },
    ...(input.known ?? []),
  );
  let next = 0;
  const service = new Sandboxes(
    sandboxes,
    DRAIN_POLICY,
    { generate: () => `sandbox_new_${++next}` },
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
    { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LoggerPort,
  );

  return { stored, sandboxes, service };
};

const forRun = (runId: string, key: string | null = 'task-task_1') => ({
  workspaceId: WORKSPACE.value,
  key,
  hostId: HOST,
  runId,
});

describe('Sandboxes', () => {
  it('starts a sandbox for a run on the host that claimed it, held by the run', async () => {
    const { stored, service } = serving();

    const id = await service.holdForRun(forRun('run_1'), STARTED_AT);
    const sandbox = stored.get(id);

    expect(sandbox?.current).toBe('starting');
    expect(sandbox?.hostId.value).toBe(HOST);
    expect(sandbox?.key?.value).toBe('task-task_1');
    expect(sandbox?.holdsRun('run_1')).toBe(true);
  });

  it('keeps one open sandbox per key: the next run drains the sandbox before it', async () => {
    const { stored, service } = serving({
      known: [placed('sandbox_1').reported().releaseRun('run_1', STARTED_AT)],
    });

    const id = await service.holdForRun(forRun('run_2'), later(1_000));

    expect(stored.get('sandbox_1')?.current).toBe('draining');
    expect(stored.get(id)?.current).toBe('starting');
    expect(
      [...stored.values()].filter(
        (each) => each.isOpen && each.key?.value === 'task-task_1',
      ),
    ).toHaveLength(1);
  });

  it('never shares a sandbox without a key', async () => {
    const { stored, service } = serving({
      known: [placed('sandbox_1', { key: null })],
    });

    await service.holdForRun(forRun('run_2', null), later(1_000));

    expect(stored.get('sandbox_1')?.current).toBe('starting');
    expect([...stored.values()].filter((each) => each.isOpen)).toHaveLength(2);
  });

  it('releases the lease of a run that left, and leaves other sandboxes alone', async () => {
    const { stored, service } = serving({
      known: [
        placed('sandbox_1').reported(),
        placed('sandbox_2', { key: 'chat-chat_1', runId: 'run_2' }).reported(),
      ],
    });

    await service.releaseRun('run_1', later(5_000));
    await service.releaseRun('run_9', later(5_000));

    expect(stored.get('sandbox_1')?.holdsRun('run_1')).toBe(false);
    expect(stored.get('sandbox_1')?.idleSince).toEqual(later(5_000));
    expect(stored.get('sandbox_2')?.holdsRun('run_2')).toBe(true);
  });

  it('marks reported sandboxes ready, loses unreported ones, and drains what it should not keep', async () => {
    const { stored, service } = serving({
      known: [
        placed('sandbox_1'),
        placed('sandbox_2', { key: 'chat-chat_1' }).reported(),
        placed('sandbox_3', { key: 'chat-chat_2' }).drain(),
        placed('sandbox_4', {
          key: 'chat-chat_3',
          host: OTHER_HOST,
        }).reported(),
      ],
    });

    const drain = await service.reconcile(
      HOST,
      ['sandbox_1', 'sandbox_3', 'sandbox_4', 'sandbox_unknown'],
      later(1_000),
    );

    expect(stored.get('sandbox_1')?.current).toBe('ready');
    expect(stored.get('sandbox_2')?.current).toBe('gone');
    expect(stored.get('sandbox_3')?.current).toBe('draining');
    expect(stored.get('sandbox_4')?.current).toBe('ready');
    expect(drain).toEqual(['sandbox_3', 'sandbox_4', 'sandbox_unknown']);
  });

  it('drains a sandbox idle past the grace, and loses sandboxes on silent hosts', async () => {
    const { stored, service } = serving({
      known: [
        placed('sandbox_1').reported().releaseRun('run_1', STARTED_AT),
        placed('sandbox_2', { key: 'chat-chat_1', runId: 'run_2' })
          .reported()
          .releaseRun('run_2', later(1_000)),
        placed('sandbox_3', { key: 'chat-chat_2', host: OTHER_HOST }),
      ],
      silentHosts: [OTHER_HOST],
    });

    await service.drainIdle(later(GRACE_MS));

    expect(stored.get('sandbox_1')?.current).toBe('draining');
    expect(stored.get('sandbox_2')?.current).toBe('ready');
    expect(stored.get('sandbox_3')?.current).toBe('gone');
  });

  it('removes sandboxes a day after they are gone', async () => {
    const { stored, service } = serving({
      known: [placed('sandbox_1').lost(STARTED_AT)],
    });

    await service.drainIdle(later(24 * 60 * 60_000 - 1));
    expect(stored.has('sandbox_1')).toBe(true);

    await service.drainIdle(later(24 * 60 * 60_000));
    expect(stored.has('sandbox_1')).toBe(false);
  });
});

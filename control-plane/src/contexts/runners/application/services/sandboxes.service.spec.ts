import { Sandboxes } from '@runners/application/services/sandboxes.service';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  DRAIN_POLICY,
  GRACE_MS,
  sandboxTokens,
  storedSandboxes,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { EDITOR_LEASE_MS } from '@runners/domain/value-objects/sandbox-lease.vo';
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
    sandboxTokens(),
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

    const { id, token } = await service.holdForRun(forRun('run_1'), STARTED_AT);
    const sandbox = stored.get(id);

    expect(sandbox?.current).toBe('starting');
    expect(sandbox?.hostId?.value).toBe(HOST);
    expect(sandbox?.tokenHash?.equals(tokenHashOf(token))).toBe(true);
    expect(sandbox?.key?.value).toBe('task-task_1');
    expect(sandbox?.holdsRun('run_1')).toBe(true);
  });

  it('keeps one open sandbox per key: the next run drains the sandbox before it', async () => {
    const { stored, service } = serving({
      known: [placed('sandbox_1').reported().releaseRun('run_1', STARTED_AT)],
    });

    const { id } = await service.holdForRun(forRun('run_2'), later(1_000));

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
      false,
    );

    expect(stored.get('sandbox_1')?.current).toBe('ready');
    expect(stored.get('sandbox_2')?.current).toBe('gone');
    expect(stored.get('sandbox_3')?.current).toBe('draining');
    expect(stored.get('sandbox_4')?.current).toBe('ready');
    expect(drain).toEqual(['sandbox_3', 'sandbox_4', 'sandbox_unknown']);
  });

  it('drains the idle sandboxes of a host that stops, and keeps those a run holds until the run leaves', async () => {
    const { stored, service } = serving({
      known: [
        placed('sandbox_1').reported(),
        placed('sandbox_2', { key: 'chat-chat_1', runId: 'run_2' })
          .reported()
          .releaseRun('run_2', later(500)),
      ],
    });

    const drain = await service.reconcile(
      HOST,
      ['sandbox_1', 'sandbox_2'],
      later(1_000),
      true,
    );

    expect(stored.get('sandbox_1')?.current).toBe('ready');
    expect(stored.get('sandbox_2')?.current).toBe('draining');
    expect(drain).toEqual(['sandbox_2']);

    await service.releaseRun('run_1', later(2_000));

    expect(
      await service.reconcile(
        HOST,
        ['sandbox_1', 'sandbox_2'],
        later(3_000),
        true,
      ),
    ).toEqual(['sandbox_1', 'sandbox_2']);
    expect(stored.get('sandbox_1')?.current).toBe('draining');
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

  describe('the next run of a key with a live sandbox', () => {
    const idle = () =>
      placed('sandbox_1').reported().releaseRun('run_1', later(1_000));

    it('is taken by the ready sandbox on the host that claims for it', async () => {
      const { service } = serving({ known: [idle()] });

      await expect(service.takingRuns('sandbox_1', HOST)).resolves.toEqual({
        id: 'sandbox_1',
        workspaceId: WORKSPACE.value,
        key: 'task-task_1',
      });
      await expect(
        service.takingRuns('sandbox_1', OTHER_HOST),
      ).resolves.toBeNull();
      await expect(service.takingRuns('sandbox_9', HOST)).resolves.toBeNull();
    });

    it('is taken by no sandbox that has a run in it, or that drains', async () => {
      for (const sandbox of [placed('sandbox_1').reported(), idle().drain()]) {
        const { service } = serving({ known: [sandbox] });

        await expect(service.takingRuns('sandbox_1', HOST)).resolves.toBeNull();
      }
    });

    it('holds the run in the sandbox it was claimed for', async () => {
      const { stored, service } = serving({ known: [idle()] });

      await expect(
        service.holdInSandbox('sandbox_1', forRun('run_2'), later(2_000)),
      ).resolves.toBe(true);
      expect(stored.get('sandbox_1')?.holdsRun('run_2')).toBe(true);
      expect(stored.size).toBe(1);
    });

    it('is not held by a sandbox that took another run or drained meanwhile', async () => {
      for (const sandbox of [
        idle().holdRun('run_3', later(1_500)),
        idle().drain(),
      ]) {
        const { stored, service } = serving({ known: [sandbox] });

        await expect(
          service.holdInSandbox('sandbox_1', forRun('run_2'), later(2_000)),
        ).resolves.toBe(false);
        expect(stored.get('sandbox_1')?.holdsRun('run_2')).toBe(false);
      }
    });

    it('is not held by a sandbox of another key', async () => {
      const { service } = serving({ known: [idle()] });

      await expect(
        service.holdInSandbox(
          'sandbox_1',
          forRun('run_2', 'task-task_2'),
          later(2_000),
        ),
      ).resolves.toBe(false);
    });

    it('names the keys that placed sandboxes keep until they are gone, except those on silent hosts', async () => {
      const { service } = serving({
        known: [
          placed('sandbox_1').reported(),
          placed('sandbox_2', { key: 'task-task_2' }),
          placed('sandbox_3', { key: 'chat-chat_1', host: OTHER_HOST })
            .reported()
            .releaseRun('run_1', later(1_000)),
          placed('sandbox_4', { key: 'task-task_4' }).reported().drain(),
          placed('sandbox_5', { key: 'task-task_5' }).lost(later(1_000)),
          Sandbox.request({
            id: SandboxId.of('sandbox_6'),
            workspaceId: WORKSPACE,
            key: SandboxKey.of('task-task_6'),
            at: STARTED_AT,
          }),
        ],
        silentHosts: [],
      });

      expect(
        [...(await service.liveKeysIn(WORKSPACE.value, later(2_000)))].sort(),
      ).toEqual(['chat-chat_1', 'task-task_1', 'task-task_2', 'task-task_4']);

      const silent = serving({
        known: [placed('sandbox_1').reported()],
        silentHosts: [HOST],
      });

      await expect(
        silent.service.liveKeysIn(WORKSPACE.value, later(2_000)),
      ).resolves.toEqual([]);
    });
  });
  describe('a sandbox requested with no run', () => {
    const requested = (id = 'sandbox_r', key = 'task-task_1') =>
      Sandbox.request({
        id: SandboxId.of(id),
        workspaceId: WORKSPACE,
        key: SandboxKey.of(key),
        at: STARTED_AT,
      });

    it('starts on no host and waits to be claimed', async () => {
      const { stored, service } = serving();

      const opened = await service.open(
        WORKSPACE.value,
        'task-task_1',
        STARTED_AT,
      );

      expect(opened).toEqual({ id: 'sandbox_new_1', state: 'starting' });
      expect(stored.get(opened.id)?.isRequested).toBe(true);
      await expect(service.requestedIn(WORKSPACE.value)).resolves.toEqual([
        { id: 'sandbox_new_1', key: 'task-task_1' },
      ]);
    });

    it('is the live sandbox of the key when one is open', async () => {
      const { stored, service } = serving({
        known: [placed('sandbox_1').reported()],
      });

      await expect(
        service.open(WORKSPACE.value, 'task-task_1', later(1_000)),
      ).resolves.toEqual({ id: 'sandbox_1', state: 'ready' });
      expect(stored.size).toBe(1);
    });

    it('is asked for only once while it waits', async () => {
      const { stored, service } = serving();

      const first = await service.open(
        WORKSPACE.value,
        'task-task_1',
        STARTED_AT,
      );
      const second = await service.open(
        WORKSPACE.value,
        'task-task_1',
        later(1_000),
      );

      expect(second.id).toBe(first.id);
      expect(stored.size).toBe(1);
    });

    it('starts on the host that claims it, with a token of its own', async () => {
      const { stored, service } = serving({ known: [requested()] });

      const started = await service.startRequested(
        'sandbox_r',
        HOST,
        later(5_000),
      );

      expect(started?.id).toBe('sandbox_r');
      const sandbox = stored.get('sandbox_r');
      expect(sandbox?.hostId?.value).toBe(HOST);
      expect(sandbox?.startedAt).toEqual(later(5_000));
      expect(sandbox?.idleSince).toEqual(later(5_000));
      expect(
        sandbox?.tokenHash?.equals(tokenHashOf(started?.token ?? '')),
      ).toBe(true);
      await expect(
        service.startRequested('sandbox_r', OTHER_HOST, later(6_000)),
      ).resolves.toBeNull();
      await expect(service.requestedIn(WORKSPACE.value)).resolves.toEqual([]);
    });

    it('is taken by the next run of its key, on the host that claims the run', async () => {
      const { stored, service } = serving({ known: [requested()] });

      const started = await service.holdForRun(forRun('run_2'), later(5_000));

      expect(started.id).toBe('sandbox_r');
      expect(stored.get('sandbox_r')?.holdsRun('run_2')).toBe(true);
      expect(stored.get('sandbox_r')?.hostId?.value).toBe(HOST);
      expect(stored.size).toBe(1);
    });

    it('is gone when no host claims it within the grace', async () => {
      const { stored, service } = serving({ known: [requested()] });

      await service.drainIdle(later(GRACE_MS - 1));
      expect(stored.get('sandbox_r')?.current).toBe('starting');

      await service.drainIdle(later(GRACE_MS));
      expect(stored.get('sandbox_r')?.current).toBe('gone');
    });

    it('is not lost while it waits for a host', async () => {
      const { stored, service } = serving({ known: [requested()] });

      await service.drainIdle(later(1_000));

      expect(stored.get('sandbox_r')?.current).toBe('starting');
    });
  });

  describe('a sandbox token', () => {
    it('authenticates its live sandbox only', async () => {
      const { service } = serving();
      const { id, token } = await service.holdForRun(
        forRun('run_1'),
        STARTED_AT,
      );

      await expect(service.authenticate(token)).resolves.toEqual({
        id,
        workspaceId: WORKSPACE.value,
        key: 'task-task_1',
      });
      await expect(service.authenticate('stolen')).resolves.toBeNull();
      await expect(service.authenticate(undefined)).resolves.toBeNull();
    });

    it('stops working once its sandbox is gone', async () => {
      const { stored, service } = serving();
      const { id, token } = await service.holdForRun(
        forRun('run_1'),
        STARTED_AT,
      );
      const sandbox = stored.get(id);
      if (sandbox) {
        stored.set(id, sandbox.lost(later(1_000)));
      }

      await expect(service.authenticate(token)).resolves.toBeNull();
    });
  });

  it('drains a ready sandbox that cannot take the run its key queued', async () => {
    const { stored, service } = serving({
      known: [placed('sandbox_1').reported().releaseRun('run_1', later(1_000))],
    });

    await service.drain('sandbox_1');

    expect(stored.get('sandbox_1')?.current).toBe('draining');
  });

  describe('an editor connection', () => {
    const idleReady = () =>
      placed('sandbox_e').reported().releaseRun('run_1', later(0));

    it('holds an open sandbox and renews its lease, and says what state the sandbox is in', async () => {
      const { stored, service } = serving({ known: [idleReady()] });

      expect(
        await service.holdForEditor('sandbox_e', 'conn_1', later(1_000)),
      ).toBe('ready');
      expect(
        await service.holdForEditor('sandbox_e', 'conn_1', later(31_000)),
      ).toBe('ready');

      const held = stored.get('sandbox_e');
      expect(held?.leases.map((each) => [each.kind, each.holder])).toEqual([
        ['editor', 'conn_1'],
      ]);
      expect(held?.leases[0]?.renewedAt).toEqual(later(31_000));
      expect(await service.stateOf('sandbox_e')).toBe('ready');
    });

    it('holds no sandbox that drains, is gone or unknown', async () => {
      const { service } = serving({ known: [idleReady().drain()] });

      expect(
        await service.holdForEditor('sandbox_e', 'conn_1', later(1)),
      ).toBeNull();
      expect(
        await service.holdForEditor('sandbox_none', 'conn_1', later(1)),
      ).toBeNull();
      expect(await service.stateOf('sandbox_none')).toBeNull();
    });

    it('admits a holder only while its editor lease is live', async () => {
      const { service } = serving({ known: [idleReady()] });
      await service.holdForEditor('sandbox_e', 'conn_1', later(1_000));

      expect(
        await service.heldByEditor('sandbox_e', 'conn_1', later(2_000)),
      ).toBe(true);
      expect(
        await service.heldByEditor('sandbox_e', 'conn_2', later(2_000)),
      ).toBe(false);
      expect(
        await service.heldByEditor(
          'sandbox_e',
          'conn_1',
          later(1_000 + EDITOR_LEASE_MS),
        ),
      ).toBe(false);
      expect(
        await service.heldByEditor('sandbox_none', 'conn_1', later(2_000)),
      ).toBe(false);
    });

    it('keeps the sandbox past the grace while it holds it, and the grace starts again once it leaves', async () => {
      const { stored, service } = serving({ known: [idleReady()] });
      await service.holdForEditor('sandbox_e', 'conn_1', later(1_000));

      await service.holdForEditor('sandbox_e', 'conn_1', later(GRACE_MS * 2));
      await service.drainIdle(later(GRACE_MS * 2));
      expect(stored.get('sandbox_e')?.current).toBe('ready');

      await service.releaseEditor('sandbox_e', 'conn_1', later(GRACE_MS * 2));
      await service.drainIdle(later(GRACE_MS * 3 - 1));
      expect(stored.get('sandbox_e')?.current).toBe('ready');
      await service.drainIdle(later(GRACE_MS * 3));
      expect(stored.get('sandbox_e')?.current).toBe('draining');
    });

    it('names the host of a ready sandbox only, so an editor joins its stream there', async () => {
      const { service } = serving({
        known: [
          idleReady(),
          placed('sandbox_s', { key: 'chat-chat_1' }),
          placed('sandbox_d', { key: 'chat-chat_2' }).reported().drain(),
        ],
      });

      expect(await service.readyOn('sandbox_e')).toBe(HOST);
      expect(await service.readyOn('sandbox_s')).toBeNull();
      expect(await service.readyOn('sandbox_d')).toBeNull();
      expect(await service.readyOn('sandbox_none')).toBeNull();
    });
  });
});

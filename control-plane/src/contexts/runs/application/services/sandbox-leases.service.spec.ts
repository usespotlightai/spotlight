import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import { SandboxLeases } from '@runs/application/services/sandbox-leases.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-02T20:00:00.000Z');

const RUN = RunId.of('run_1');

const orderingOf = (key: string) => {
  if (key.startsWith('task-')) {
    return orderedFor.holdingTurn('task_1', 0);
  }
  if (key.startsWith('chat-')) {
    return orderedFor.conversing('chat_1');
  }

  return orderedFor.spec('run_1', key);
};

const runWithKey = (key: string) =>
  Run.enqueue({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    ...orderingOf(key),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what the request wants',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  });

const leasing = (run: Run | null) => {
  const sandboxes = {
    releaseRun: vi.fn(async () => {}),
    retireRun: vi.fn(async () => {}),
  };
  const runs = { findById: vi.fn(async () => run) };
  const leases = new SandboxLeases(
    sandboxes as unknown as SandboxesPort,
    runs as unknown as RunRepository,
    { now: () => NOW, sleep: async () => {} },
  );

  return { leases, sandboxes };
};

describe('SandboxLeases', () => {
  it('keeps the sandbox of a run that left it and comes back', async () => {
    const { leases, sandboxes } = leasing(runWithKey('scratch'));

    await leases.runLeft(RUN);

    expect(sandboxes.releaseRun).toHaveBeenCalledWith('run_1', NOW);
    expect(sandboxes.retireRun).not.toHaveBeenCalled();
  });

  it.each([
    ['a task', 'task-task_1'],
    ['a chat', 'chat-chat_1'],
  ])(
    'keeps the sandbox of an ended run of %s for later runs and editors',
    async (_, key) => {
      const { leases, sandboxes } = leasing(runWithKey(key));

      await leases.runEnded(RUN);

      expect(sandboxes.releaseRun).toHaveBeenCalledWith('run_1', NOW);
      expect(sandboxes.retireRun).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a workspace nothing rejoins', runWithKey('scratch')],
    ['a run it cannot find', null],
  ])(
    'retires the sandbox of an ended run with %s, as nothing rejoins it',
    async (_, run) => {
      const { leases, sandboxes } = leasing(run);

      await leases.runEnded(RUN);

      expect(sandboxes.retireRun).toHaveBeenCalledWith('run_1', NOW);
      expect(sandboxes.releaseRun).not.toHaveBeenCalled();
    },
  );
});

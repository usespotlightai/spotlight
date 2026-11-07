import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SandboxLeases } from '@work/application/services/sandbox-leases.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-02T20:00:00.000Z');

const RUN = RunId.of('run_1');

const subjectOwning = (key: string): RunSubject | null => {
  if (key.startsWith('task-')) {
    return RunSubject.task(TaskId.of('task_1'), null, TaskRevision.of(0));
  }
  if (key.startsWith('chat-')) {
    return RunSubject.chat(ChatId.of('chat_1'));
  }

  return null;
};

const runWithKey = (key: string) =>
  Run.enqueue({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    subject: subjectOwning(key),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what the request wants',
      handover: { options: [], noteLimit: 4_000 },
      resume: { key },
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
    ['a key of no task or chat', runWithKey('scratch')],
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

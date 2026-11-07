import { StartGateUnavailableError } from '@runs/application/ports/run-start-gates.port';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type {
  TaskViewDto,
  TaskViewsPort,
} from '@work/application/ports/task-views.port';
import { TaskRunStartGate } from '@work/application/services/task-run-start-gate.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const UNTIL = new Date('2026-09-26T09:00:10.000Z');
const TEAM = TeamId.of('team_1');

const gating = (viewed = true, failure: Error | null = null) => {
  const of = vi.fn(async (taskId: string, runId: string | null) =>
    viewed ? ({ taskId, runId } as unknown as TaskViewDto) : null,
  );
  const before = vi.fn(async () => {
    if (failure) {
      throw failure;
    }

    return { kind: 'denied' as const, reason: 'frozen' };
  });

  return {
    of,
    before,
    gate: new TaskRunStartGate(
      { of } as unknown as TaskViewsPort,
      { before } as unknown as LifecycleHooksPort,
    ),
  };
};

const starting = (requester: ReturnType<typeof WorkRequesters.task>) => ({
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  requester,
});

describe('TaskRunStartGate', () => {
  it('asks the before hooks about the task of a task’s run', async () => {
    const { gate, of, before } = gating();

    expect(
      await gate.mayStart(
        starting(
          WorkRequesters.task(TaskId.of('task_1'), TaskRevision.of(0), TEAM),
        ),
        UNTIL,
      ),
    ).toEqual({ kind: 'denied', reason: 'frozen' });
    expect(of).toHaveBeenCalledWith('task_1', 'run_1');
    expect(before).toHaveBeenCalledWith(
      { taskId: 'task_1', runId: 'run_1' },
      { on: 'run.starting' },
      UNTIL,
    );
  });

  it('lets a chat’s run start without asking a hook', async () => {
    const { gate, before } = gating();

    expect(
      await gate.mayStart(
        starting(WorkRequesters.chat(ChatId.of('chat_1'), TEAM)),
        UNTIL,
      ),
    ).toEqual({ kind: 'allowed' });
    expect(before).not.toHaveBeenCalled();
  });

  it('lets a run start whose task no hook can learn of', async () => {
    const { gate, before } = gating(false);

    expect(
      await gate.mayStart(
        starting(
          WorkRequesters.task(TaskId.of('task_1'), TaskRevision.of(0), TEAM),
        ),
        UNTIL,
      ),
    ).toEqual({ kind: 'allowed' });
    expect(before).not.toHaveBeenCalled();
  });

  describe('when the hooks cannot answer', () => {
    const taskRun = starting(
      WorkRequesters.task(TaskId.of('task_1'), TaskRevision.of(0), TEAM),
    );

    it('reports the gate unavailable for a store or upstream failure', async () => {
      await expect(
        gating(true, new Error('connect ECONNREFUSED')).gate.mayStart(
          taskRun,
          UNTIL,
        ),
      ).rejects.toBeInstanceOf(StartGateUnavailableError);
      await expect(
        gating(true, new UpstreamError('hook', 'timed out')).gate.mayStart(
          taskRun,
          UNTIL,
        ),
      ).rejects.toBeInstanceOf(StartGateUnavailableError);
    });

    it('lets a domain or programming error through', async () => {
      await expect(
        gating(
          true,
          new InconsistentStateError('hook', 'is torn'),
        ).gate.mayStart(taskRun, UNTIL),
      ).rejects.toBeInstanceOf(InconsistentStateError);
      await expect(
        gating(true, new TypeError('x is undefined')).gate.mayStart(
          taskRun,
          UNTIL,
        ),
      ).rejects.toBeInstanceOf(TypeError);
    });
  });
});

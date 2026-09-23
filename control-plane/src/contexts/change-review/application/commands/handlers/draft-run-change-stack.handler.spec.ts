import { DraftRunChangeStackCommand } from '@change-review/application/commands/draft-run-change-stack.command';
import { DraftRunChangeStackHandler } from '@change-review/application/commands/handlers/draft-run-change-stack.handler';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const drafting = (
  over: { worked?: boolean; request?: CheckRequest | null } = {},
) => {
  const begin = vi.fn(async () => ({}) as never);

  const work = {
    run: async () => ({
      id: RunId.of(RUN),
      workspaceId: WorkspaceId.of('ws_1'),
      taskId: TaskId.of('task_1'),
      request: over.request ?? null,
      ended: false,
      completed: false,
      decisions: false,
    }),
    wasWorkedBy: async () => over.worked !== false,
    reasoning: async () => null,
    task: async () => null,
    taskWithPullRequest: async () => null,
  } satisfies WorkPort;

  return {
    handler: new DraftRunChangeStackHandler(work, {
      begin,
    } as unknown as DraftChangeStack),
    begin,
  };
};

const handed = new DraftRunChangeStackCommand(
  RUN,
  'runner_1',
  'diff --git a/a.ts b/a.ts',
  'widgets',
  null,
);

describe('DraftRunChangeStackHandler', () => {
  it('drafts what the run left behind, with the station’s check to run on it', async () => {
    const { handler, begin } = drafting({
      request: CheckRequest.of('npm test', null),
    });

    await handler.execute(handed);

    expect(begin).toHaveBeenCalledWith(
      {
        id: RunId.of(RUN),
        taskId: TaskId.of('task_1'),
        workspaceId: WorkspaceId.of('ws_1'),
      },
      {
        diff: 'diff --git a/a.ts b/a.ts',
        repository: 'widgets',
        base: null,
        request: CheckRequest.of('npm test', null),
      },
    );
  });

  it('drafts nothing for a run this runner did not work', async () => {
    const { handler, begin } = drafting({ worked: false });

    await expect(handler.execute(handed)).rejects.toThrow(UseCaseFault);
    expect(begin).not.toHaveBeenCalled();
  });
});

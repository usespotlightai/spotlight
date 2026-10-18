import { GenerateRunChangeStackCommand } from '@change-review/application/commands/generate-run-change-stack.command';
import { GenerateRunChangeStackHandler } from '@change-review/application/commands/handlers/generate-run-change-stack.handler';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import {
  type CheckingPlan,
  CheckRequest,
} from '@change-review/domain/value-objects/check-request.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const generating = (
  over: {
    worked?: boolean;
    checking?: CheckingPlan | null;
    replay?: boolean;
    isSearch?: boolean;
  } = {},
) => {
  const begin = vi.fn(async () => ({}) as never);

  const work = {
    run: async () => ({
      id: RunId.of(RUN),
      workspaceId: WorkspaceId.of('ws_1'),
      taskId: over.replay ? null : TaskId.of('task_1'),
      checking: over.checking ?? null,
      ended: false,
      completed: false,
      decisions: false,
      isReplay: over.replay === true,
      isSearch: over.isSearch === true,
    }),
    wasWorkedBy: async () => over.worked !== false,
    teamOfRun: async () => null,
    reasoning: async () => null,
    task: async () => null,
    taskWithPullRequest: async () => null,
  } satisfies WorkPort;

  return {
    handler: new GenerateRunChangeStackHandler(work, {
      begin,
    } as unknown as GenerateChangeStack),
    begin,
  };
};

const handed = (repository: string | null = 'widgets') =>
  new GenerateRunChangeStackCommand(
    RUN,
    'runner_1',
    'diff --git a/a.ts b/a.ts',
    repository,
    null,
  );

const placement = RunnerPlacement.anywhere().in(
  RunnerImage.of('ghcr.io/acme/widgets:1'),
);

const checking: CheckingPlan = {
  command: 'npm test',
  setups: new Map([
    ['widgets', 'npm ci'],
    ['gadgets', 'pnpm install'],
  ]),
  placement,
};

describe('GenerateRunChangeStackHandler', () => {
  it('generates what the run left behind, with the station’s check to run on it', async () => {
    const { handler, begin } = generating({ checking });

    await handler.execute(handed());

    expect(begin).toHaveBeenCalledWith(
      {
        id: RunId.of(RUN),
        taskId: TaskId.of('task_1'),
        isReplay: false,
        isSearch: false,
        workspaceId: WorkspaceId.of('ws_1'),
      },
      {
        diff: 'diff --git a/a.ts b/a.ts',
        repository: 'widgets',
        base: null,
        request: CheckRequest.of('npm test', 'npm ci', placement),
      },
    );
  });

  it('prepares the check with the setup of the repository the diff came from', async () => {
    const { handler, begin } = generating({ checking });

    await handler.execute(handed('gadgets'));

    expect(begin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        request: CheckRequest.of('npm test', 'pnpm install', placement),
      }),
    );
  });

  it('checks without a setup when the repository declares none', async () => {
    const { handler, begin } = generating({ checking });

    await handler.execute(handed(null));

    expect(begin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        request: CheckRequest.of('npm test', null, placement),
      }),
    );
  });

  it('requests no check when the station has none', async () => {
    const { handler, begin } = generating({ checking: null });

    await handler.execute(handed());

    expect(begin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ request: null }),
    );
  });

  it('requests no check when the station’s check command is blank', async () => {
    const { handler, begin } = generating({
      checking: { ...checking, command: '   ' },
    });

    await handler.execute(handed());

    expect(begin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ request: null }),
    );
  });

  it('generates nothing for a run this runner did not work', async () => {
    const { handler, begin } = generating({ worked: false });

    await expect(handler.execute(handed())).rejects.toThrow(ApplicationError);
    expect(begin).not.toHaveBeenCalled();
  });

  it('generates a replay’s change as the replay’s own, with the check its run was dispatched with', async () => {
    const { handler, begin } = generating({ checking, replay: true });

    await handler.execute(handed());

    expect(begin).toHaveBeenCalledWith(
      {
        id: RunId.of(RUN),
        taskId: null,
        isReplay: true,
        isSearch: false,
        workspaceId: WorkspaceId.of('ws_1'),
      },
      expect.objectContaining({
        request: CheckRequest.of('npm test', 'npm ci', placement),
      }),
    );
  });
});

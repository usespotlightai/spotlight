import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type { IntegrationToolCallsPort } from '@work/application/ports/integration-tool-calls.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import { IntegrationTools } from '@work/application/services/integration-tools.service';
import type { RunWorks } from '@work/application/services/run-works.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { LeaseLostError } from '@work/domain/exceptions/lease-lost.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN = RunId.of('run_1');
const ATTEMPT = { runId: RUN, attempt: 2 };

const CONTEXT: TaskToolContext = {
  kind: 'task',
  runId: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_1'),
  requester: null,
};

const resolving = (options: { movedOn?: boolean } = {}) => {
  const steps: string[] = [];
  const stillOn = vi.fn(() => {
    steps.push('still on');
    if (options.movedOn === true) {
      return Promise.reject(new LeaseLostError(RUN.value, ATTEMPT.attempt));
    }

    return Promise.resolve();
  });
  const calls: IntegrationToolCallsPort = {
    resolve: () =>
      Promise.resolve({
        declared: {
          tool: 'linear.comment',
          integrationName: 'Linear',
          description: 'Comment on an issue',
          inputs: [],
          approval: null,
          inferredOutput: null,
          readOnly: false,
        },
        actingAs: null,
        missing: null,
        personRule: null,
        defaultFor: () => undefined,
        call: () => {
          steps.push('called with its secrets injected');
          return Promise.resolve({ outcome: 'answered', output: 'commented' });
        },
      }),
  };

  const tools = new IntegrationTools(
    partial<TaskRepository>({
      find: () => Promise.resolve(partial<Task>({})),
    }),
    partial<LineMapsPort>({
      findByStation: () => Promise.resolve(partial<LineMap>({})),
    }),
    partial<IntegrationTaskViews>({
      of: () => Promise.resolve(partial<IntegrationTaskViewDto>({})),
    }),
    calls,
    partial<RunWorks>({ stillOn }),
  );

  return { tools, steps, stillOn };
};

describe('IntegrationTools', () => {
  it('makes sure the runner is still on the attempt right before the call injects its secrets', async () => {
    const { tools, steps, stillOn } = resolving();
    const resolved = await tools.resolve(
      Tool.of('linear.comment'),
      CONTEXT,
      ATTEMPT,
      'runner_1',
    );

    await expect(resolved?.call(ToolInputs.of({}))).resolves.toEqual({
      outcome: 'answered',
      output: 'commented',
    });
    expect(stillOn).toHaveBeenCalledWith(ATTEMPT, 'runner_1');
    expect(steps).toEqual(['still on', 'called with its secrets injected']);
  });

  it('never calls the integration once the attempt moved on after the tool was resolved', async () => {
    const { tools, steps } = resolving({ movedOn: true });
    const resolved = await tools.resolve(
      Tool.of('linear.comment'),
      CONTEXT,
      ATTEMPT,
      'runner_1',
    );

    await expect(resolved?.call(ToolInputs.of({}))).rejects.toThrow(
      LeaseLostError,
    );
    expect(steps).toEqual(['still on']);
  });
});

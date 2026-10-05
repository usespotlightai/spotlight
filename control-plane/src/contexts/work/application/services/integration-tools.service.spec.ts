import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type { IntegrationToolCallsPort } from '@work/application/ports/integration-tool-calls.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import { IntegrationTools } from '@work/application/services/integration-tools.service';
import type { RunWorks } from '@work/application/services/run-works.service';
import type { TaskBindings } from '@work/application/services/task-bindings.service';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN = RunId.of('run_1');
const ATTEMPT = RunAttempt.of(RUN, 2);

const CONTEXT: TaskToolContext = {
  kind: 'task',
  runId: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_1'),
  requester: null,
};

const reaching = (given: { movedOn?: boolean } = {}) => {
  const steps: string[] = [];
  const stillOn = vi.fn(async () => {
    steps.push('still on');
    if (given.movedOn) {
      throw new RunAttemptOverError(RUN.value, ATTEMPT.number);
    }
  });
  const calls: IntegrationToolCallsPort = {
    reach: async () => ({
      declared: {
        tool: 'linear.comment',
        integrationName: 'Linear',
        description: 'Comment on an issue',
        inputs: [],
        approval: null,
        learnedOutput: null,
      },
      actingAs: null,
      wants: null,
      personRule: null,
      defaultFor: () => undefined,
      call: async () => {
        steps.push('called with its secrets worn');
        return 'commented';
      },
    }),
  };

  const tools = new IntegrationTools(
    { find: async () => ({}) } as unknown as TaskRepository,
    { holding: async () => ({}) } as unknown as LineRepository,
    { of: async () => ({}) as BoundTaskDto } as unknown as TaskBindings,
    calls,
    { stillOn } as unknown as RunWorks,
  );

  return { tools, steps, stillOn };
};

describe('IntegrationTools', () => {
  it('makes sure the runner is still on the attempt right before the call wears its secrets', async () => {
    const { tools, steps, stillOn } = reaching();
    const reachable = await tools.reach(
      Tool.of('linear.comment'),
      CONTEXT,
      ATTEMPT,
      'runner_1',
    );

    await expect(reachable?.call(ToolInputs.of({}))).resolves.toBe('commented');
    expect(stillOn).toHaveBeenCalledWith(ATTEMPT, 'runner_1');
    expect(steps).toEqual(['still on', 'called with its secrets worn']);
  });

  it('never calls the integration once the attempt moved on after the tool was reached', async () => {
    const { tools, steps } = reaching({ movedOn: true });
    const reachable = await tools.reach(
      Tool.of('linear.comment'),
      CONTEXT,
      ATTEMPT,
      'runner_1',
    );

    await expect(reachable?.call(ToolInputs.of({}))).rejects.toThrow(
      RunAttemptOverError,
    );
    expect(steps).toEqual(['still on']);
  });
});

import type { HooksListening } from '@integrations/application/services/hooks-listening.service';
import type { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import type { RunBeforeHooks } from '@integrations/application/services/run-before-hooks.service';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { runStarting } from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { LifecycleHooks } from '@integrations/infrastructure/acl/lifecycle-hooks.adapter';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { TaskViewDto } from '@work/application/ports/task-views.port';
import { describe, expect, it, vi } from 'vitest';

const TASK: TaskViewDto = {
  taskId: 'task_1',
  workspaceId: 'workspace_1',
  teamId: 'team_1',
  title: 'Add a column',
  url: 'https://spotlight.example.com/t/1',
  line: 'delivery',
  station: 'Implementation',
  stationKey: 'implementation',
  marks: {},
  repositories: ['acme/api'],
  pullRequest: null,
  pullRequests: [],
  runId: 'run_1',
};

const setUp = (decide = vi.fn()) => {
  const on = vi.fn(async () => true);
  const toolUsed = vi.fn(async () => {});

  return {
    on,
    decide,
    toolUsed,
    hooks: new LifecycleHooks(
      { on } as unknown as HooksListening,
      { decide } as unknown as RunBeforeHooks,
      { toolUsed } as unknown as LifecycleHookTriggers,
    ),
  };
};

describe('LifecycleHooks', () => {
  it('asks whether a hook of the team listens', async () => {
    const { hooks, on } = setUp();

    await expect(hooks.listens('team_1', 'run.starting')).resolves.toBe(true);
    expect(on).toHaveBeenCalledWith(TeamId.of('team_1'), 'run.starting');
  });

  it('hands each use of a tool over with its occurrence', async () => {
    const { hooks, toolUsed } = setUp();
    const used = {
      on: 'tool.used' as const,
      tool: 'github.comment',
      inputs: {},
      output: null,
      failed: false,
    };

    await hooks.after(TASK, used, 'call_1');

    expect(toolUsed).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: TaskId.of('task_1') }),
      {
        on: 'tool.used',
        tool: Tool.of('github.comment'),
        inputs: {},
        output: null,
        failed: false,
      },
      HookOccurrenceKey.of('call_1'),
    );
  });

  it('answers Work in its own words for what the hooks decided', async () => {
    const decide = vi
      .fn()
      .mockResolvedValueOnce(HookDecision.allowed())
      .mockResolvedValueOnce(HookDecision.denied('The hook dba says no'));
    const { hooks } = setUp(decide);
    const starting = { on: 'run.starting' as const };

    await expect(hooks.before(TASK, starting)).resolves.toEqual({
      kind: 'allowed',
    });
    await expect(hooks.before(TASK, starting)).resolves.toEqual({
      kind: 'denied',
      reason: 'The hook dba says no',
    });
    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: TaskId.of('task_1'),
        runId: RunId.of('run_1'),
      }),
      runStarting(),
      null,
    );
  });
});

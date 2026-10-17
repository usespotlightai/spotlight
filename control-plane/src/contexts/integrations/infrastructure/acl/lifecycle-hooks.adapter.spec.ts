import type {
  FireHooks,
  Happened,
} from '@integrations/application/services/fire-hooks.service';
import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import { LifecycleHooks } from '@integrations/infrastructure/acl/lifecycle-hooks.adapter';
import type { HookedTaskDto } from '@work/application/ports/hooked-tasks.port';
import { describe, expect, it, vi } from 'vitest';

const TASK: HookedTaskDto = {
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
  runId: 'run_1',
};

describe('LifecycleHooks', () => {
  it('tells each use of a tool apart, so using one often is never read as a loop', async () => {
    const happened = vi.fn(async (_happened: Happened) => 1);
    const hooks = new LifecycleHooks({ happened } as unknown as FireHooks);
    const used = {
      on: 'tool.used' as const,
      tool: 'github.comment',
      inputs: {},
      output: null,
      failed: false,
    };

    await hooks.after(TASK, used, 'call_1');
    await hooks.after(TASK, used, 'call_2');

    const [first, second] = happened.mock.calls.map(([each]) => each.change);
    expect(first).not.toBe(second);
    expect(first).toContain('github.comment');
  });

  it('answers Work in its own words for what the hooks decided', async () => {
    const before = vi
      .fn()
      .mockResolvedValueOnce(HookVerdict.allowed())
      .mockResolvedValueOnce(HookVerdict.denied('The hook dba says no'));
    const hooks = new LifecycleHooks({ before } as unknown as FireHooks);
    const starting = { on: 'run.starting' as const };

    await expect(hooks.before(TASK, starting)).resolves.toEqual({
      kind: 'allowed',
    });
    await expect(hooks.before(TASK, starting)).resolves.toEqual({
      kind: 'denied',
      reason: 'The hook dba says no',
    });
    expect(before).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task_1', runId: 'run_1' }),
      'run.starting',
      {},
      null,
    );
  });
});

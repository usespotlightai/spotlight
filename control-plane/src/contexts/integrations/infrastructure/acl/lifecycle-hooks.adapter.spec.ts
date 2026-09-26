import type {
  Happened,
  HookFirings,
} from '@integrations/application/services/hook-firings.service';
import { LifecycleHooks } from '@integrations/infrastructure/acl/lifecycle-hooks.adapter';
import type { HookedTaskDto } from '@work/application/ports/hooked-tasks.port';
import { describe, expect, it, vi } from 'vitest';

const TASK = { taskId: 'task_1' } as HookedTaskDto;

describe('LifecycleHooks', () => {
  it('tells each use of a tool apart, so using one often is never read as a loop', async () => {
    const happened = vi.fn(async (_happened: Happened) => 1);
    const hooks = new LifecycleHooks({ happened } as unknown as HookFirings);
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
});

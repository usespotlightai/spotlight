import type { ToolContext } from '@application/ports/integration-tools.port';
import {
  BuiltInTools,
  type BuiltInToolUse,
} from '@application/services/built-in-tools.service';
import { builtInTool, PULL_REQUEST } from '@domain/services/built-in-tools';
import { Tool } from '@domain/value-objects/tool.vo';
import { ToolInputs } from '@domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const CONTEXT = {
  run: { id: 'run_1' },
  task: { id: 'task_1' },
  line: { id: 'line_1' },
} as unknown as ToolContext;

const answering: BuiltInToolUse = {
  tool: PULL_REQUEST,
  call: async (context, inputs) => ({
    task: (context.task as unknown as { id: string }).id,
    title: inputs.text('title'),
  }),
};

describe('BuiltInTools', () => {
  it('will not start with a tool Spotlight declares and nothing uses', () => {
    expect(() => new BuiltInTools([])).toThrow(
      'Spotlight declares pull-request, and nothing here uses it',
    );
  });

  it('reaches a tool of Spotlight’s own, as it is declared, calling its use for the run', async () => {
    const reached = new BuiltInTools([answering]).reach(PULL_REQUEST, CONTEXT);

    expect(reached?.declared).toBe(builtInTool(PULL_REQUEST)?.declared);
    expect(
      reached?.defaultFor(
        builtInTool(PULL_REQUEST)?.declared.inputs[0] as never,
      ),
    ).toBeUndefined();
    await expect(
      reached?.call(ToolInputs.of({ title: 'Fix the queue' })),
    ).resolves.toEqual({ task: 'task_1', title: 'Fix the queue' });
  });

  it('reaches nothing Spotlight does not declare', () => {
    const tools = new BuiltInTools([answering]);

    expect(tools.reach(Tool.of('teleport'), CONTEXT)).toBeNull();
    expect(tools.reach(Tool.of('linear.comment'), CONTEXT)).toBeNull();
  });
});

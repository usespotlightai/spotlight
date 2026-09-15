import type {
  ChatToolContext,
  TaskToolContext,
} from '@application/ports/integration-tools.port';
import {
  BuiltInTools,
  type BuiltInToolUse,
} from '@application/services/built-in-tools.service';
import {
  builtInTool,
  PROPOSE_TASK,
  PULL_REQUEST,
} from '@domain/services/built-in-tools';
import { Tool } from '@domain/value-objects/tool.vo';
import { ToolInputs } from '@domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const ON_TASK = {
  kind: 'task',
  run: { id: 'run_1' },
  task: { id: 'task_1' },
  line: { id: 'line_1' },
} as unknown as TaskToolContext;

const IN_CHAT = {
  kind: 'chat',
  run: { id: 'run_2' },
  chat: { id: 'chat_1' },
  lines: [],
} as unknown as ChatToolContext;

const answering: BuiltInToolUse<TaskToolContext> = {
  tool: PULL_REQUEST,
  call: async (context, inputs) => ({
    task: (context.task as unknown as { id: string }).id,
    title: inputs.text('title'),
  }),
};

const proposing: BuiltInToolUse<ChatToolContext> = {
  tool: PROPOSE_TASK,
  call: async () => 'proposed',
};

describe('BuiltInTools', () => {
  it('will not start with a tool Spotlight declares and nothing uses', () => {
    expect(() => new BuiltInTools([answering])).toThrow(
      'Spotlight declares propose-task, and nothing here uses it',
    );
  });

  it('reaches a tool of Spotlight’s own, as it is declared, calling its use for the run', async () => {
    const reached = new BuiltInTools([answering, proposing]).reach(
      PULL_REQUEST,
      ON_TASK,
    );

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

  it('reaches a tool only for the kind of work it is made for', () => {
    const tools = new BuiltInTools([answering, proposing]);

    expect(tools.reach(PULL_REQUEST, IN_CHAT)).toBeNull();
    expect(tools.reach(PROPOSE_TASK, ON_TASK)).toBeNull();
    expect(tools.reach(PROPOSE_TASK, IN_CHAT)).not.toBeNull();
  });

  it('reaches nothing Spotlight does not declare', () => {
    const tools = new BuiltInTools([answering, proposing]);

    expect(tools.reach(Tool.of('teleport'), ON_TASK)).toBeNull();
    expect(tools.reach(Tool.of('linear.comment'), ON_TASK)).toBeNull();
  });
});

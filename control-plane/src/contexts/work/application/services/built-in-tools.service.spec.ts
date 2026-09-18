import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ChatToolContext,
  TaskToolContext,
} from '@work/application/ports/integration-tools.port';
import {
  BuiltInTools,
  type BuiltInToolUse,
} from '@work/application/services/built-in-tools.service';
import {
  builtInTool,
  PROPOSE_TASK,
  PULL_REQUEST,
} from '@work/domain/services/built-in-tools';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const ON_TASK: TaskToolContext = {
  kind: 'task',
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_1'),
};

const IN_CHAT: ChatToolContext = {
  kind: 'chat',
  runId: RunId.of('run_2'),
  workspaceId: WorkspaceId.of('ws_1'),
  chatId: ChatId.of('chat_1'),
  teamId: TeamId.of('team_1'),
};

const answering: BuiltInToolUse<TaskToolContext> = {
  tool: PULL_REQUEST,
  call: async (context, inputs) => ({
    task: context.taskId.value,
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

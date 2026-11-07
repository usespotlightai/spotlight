import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { ChatToolExtension } from '@work/application/ports/chat-tool-extensions.port';
import type {
  ChatToolContext,
  TaskToolContext,
} from '@work/application/ports/integration-tools.port';
import { BuiltInTools } from '@work/application/services/built-in-tools.service';
import { ChatToolExtensions } from '@work/application/services/chat-tool-extensions.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import {
  builtInTool,
  CHECKS,
  PROPOSE_TASK,
  PULL_REQUEST,
  REVIEW,
  REVIEW_COMMENT,
  SETUP_PULL_REQUEST,
} from '@work/domain/services/built-in-tools';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const ON_TASK: TaskToolContext = {
  kind: 'task',
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_1'),
  requester: null,
};

const IN_CHAT: ChatToolContext = {
  kind: 'chat',
  runId: RunId.of('run_2'),
  workspaceId: WorkspaceId.of('ws_1'),
  chatId: ChatId.of('chat_1'),
  teamId: TeamId.of('team_1'),
  requester: null,
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

const reviewing: BuiltInToolUse<TaskToolContext>[] = [
  REVIEW_COMMENT,
  REVIEW,
  SETUP_PULL_REQUEST,
  CHECKS,
].map((tool) => ({ tool, call: async () => null }));

const NO_EXTENSIONS = new ChatToolExtensions({
  find: async () => null,
} as unknown as ChatRepository);

describe('BuiltInTools', () => {
  it('will not start with a tool Spotlight declares and nothing uses', () => {
    expect(
      () => new BuiltInTools([answering, ...reviewing], NO_EXTENSIONS),
    ).toThrow('Spotlight declares propose-task, and nothing here uses it');
  });

  it('resolves a tool of Spotlight’s own, as it is declared, calling its use for the run', async () => {
    const resolved = new BuiltInTools(
      [answering, proposing, ...reviewing],
      NO_EXTENSIONS,
    ).resolve(PULL_REQUEST, ON_TASK);

    expect(resolved?.declared).toBe(builtInTool(PULL_REQUEST)?.declared);
    expect(
      resolved?.defaultFor(
        builtInTool(PULL_REQUEST)?.declared.inputs[0] as never,
      ),
    ).toBeUndefined();
    await expect(
      resolved?.call(ToolInputs.of({ title: 'Fix the queue' })),
    ).resolves.toEqual({
      outcome: 'answered',
      output: { task: 'task_1', title: 'Fix the queue' },
    });
  });

  it('resolves a tool only for the kind of work it is made for', () => {
    const tools = new BuiltInTools(
      [answering, proposing, ...reviewing],
      NO_EXTENSIONS,
    );

    expect(tools.resolve(PULL_REQUEST, IN_CHAT)).toBeNull();
    expect(tools.resolve(PROPOSE_TASK, ON_TASK)).toBeNull();
    expect(tools.resolve(PROPOSE_TASK, IN_CHAT)).not.toBeNull();
  });

  it('resolves nothing Spotlight does not declare', () => {
    const tools = new BuiltInTools(
      [answering, proposing, ...reviewing],
      NO_EXTENSIONS,
    );

    expect(tools.resolve(Tool.of('teleport'), ON_TASK)).toBeNull();
    expect(tools.resolve(Tool.of('linear.comment'), ON_TASK)).toBeNull();
  });

  it('resolves a tool a chat tool extension declares, for chats only', async () => {
    const extensions = new ChatToolExtensions({
      find: async () => null,
    } as unknown as ChatRepository);
    const tools = new BuiltInTools(
      [answering, proposing, ...reviewing],
      extensions,
    );
    const extension: ChatToolExtension = {
      declaration: {
        tool: 'test-station-change',
        description: 'Measure a change to the station.',
        inputs: [],
      },
      offerFor: async () => ({ offered: true, briefing: null }),
      call: async () => 'tested',
    };

    extensions.register(extension);

    expect(
      tools.resolve(Tool.of('test-station-change'), IN_CHAT)?.declared.tool
        .value,
    ).toBe('test-station-change');
    expect(tools.resolve(Tool.of('test-station-change'), ON_TASK)).toBeNull();
  });
});

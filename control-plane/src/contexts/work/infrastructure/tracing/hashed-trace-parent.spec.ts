import { traceParentOf } from '@platform/telemetry/trace-parent';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HashedTraceParent } from '@work/infrastructure/tracing/hashed-trace-parent';
import { describe, expect, it } from 'vitest';

const naming = new HashedTraceParent();

describe('HashedTraceParent', () => {
  it('traces a task’s runs on the task’s trail', () => {
    expect(naming.for(TaskId.of('task_1'), RunId.of('run_1'))).toBe(
      traceParentOf('task:task_1', 'run_1'),
    );
  });

  it('traces a chat’s runs on the chat’s trail', () => {
    expect(naming.forChat(ChatId.of('chat_1'), RunId.of('run_1'))).toBe(
      traceParentOf('chat:chat_1', 'run_1'),
    );
  });
});

import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export const TRACE_PARENT = Symbol('TRACE_PARENT');

export interface TraceParentPort {
  for(taskId: TaskId, runId: RunId): string;

  forChat(chatId: ChatId, runId: RunId): string;
}

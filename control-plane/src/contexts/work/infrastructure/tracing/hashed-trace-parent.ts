import { Injectable } from '@nestjs/common';
import { traceParentOf } from '@platform/telemetry/trace-parent';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

@Injectable()
export class HashedTraceParent implements TraceParentPort {
  for(taskId: TaskId, runId: RunId): string {
    return traceParentOf(`task:${taskId.value}`, runId.value);
  }

  forChat(chatId: ChatId, runId: RunId): string {
    return traceParentOf(`chat:${chatId.value}`, runId.value);
  }
}

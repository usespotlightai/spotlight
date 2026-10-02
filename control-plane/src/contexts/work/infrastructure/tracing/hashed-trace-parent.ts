import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { SearchId } from '@work/domain/value-objects/search-id.vo';

const VERSION = '00';
const SAMPLED = '01';

const TRACE_BYTES = 16;
const SPAN_BYTES = 8;

const hex = (of: string, bytes: number): string =>
  createHash('sha256')
    .update(of)
    .digest('hex')
    .slice(0, bytes * 2);

@Injectable()
export class HashedTraceParent implements TraceParentPort {
  for(taskId: TaskId, runId: RunId): string {
    return this.named(`task:${taskId.value}`, runId);
  }

  forChat(chatId: ChatId, runId: RunId): string {
    return this.named(`chat:${chatId.value}`, runId);
  }

  forSearch(searchId: SearchId, runId: RunId): string {
    return this.named(`search:${searchId.value}`, runId);
  }

  private named(trail: string, runId: RunId): string {
    const trace = hex(trail, TRACE_BYTES);
    const span = hex(`run:${runId.value}`, SPAN_BYTES);

    return `${VERSION}-${trace}-${span}-${SAMPLED}`;
  }
}

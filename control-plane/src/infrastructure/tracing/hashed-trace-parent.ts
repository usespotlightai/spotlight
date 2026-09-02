import { createHash } from 'node:crypto';
import type { TraceParentPort } from '@application/ports/trace-parent.port';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import { Injectable } from '@nestjs/common';

const VERSION = '00';
const SAMPLED = '01';

const TRACE_BYTES = 16;
const SPAN_BYTES = 8;

const hex = (of: string, bytes: number): string =>
  createHash('sha256')
    .update(of)
    .digest('hex')
    .slice(0, bytes * 2);

/**
 * Derives the name from the ids themselves, so nothing has to be stored or
 * remembered: a run tried a second time names itself exactly as it did the
 * first, from another process, on another machine.
 */
@Injectable()
export class HashedTraceParent implements TraceParentPort {
  for(taskId: TaskId, runId: RunId): string {
    const trace = hex(`task:${taskId.value}`, TRACE_BYTES);
    const span = hex(`run:${runId.value}`, SPAN_BYTES);

    return `${VERSION}-${trace}-${span}-${SAMPLED}`;
  }
}

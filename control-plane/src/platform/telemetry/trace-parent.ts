import { createHash } from 'node:crypto';

const VERSION = '00';
const SAMPLED = '01';

const TRACE_BYTES = 16;
const SPAN_BYTES = 8;

const hex = (of: string, bytes: number): string =>
  createHash('sha256')
    .update(of)
    .digest('hex')
    .slice(0, bytes * 2);

export const traceParentOf = (trail: string, runId: string): string =>
  `${VERSION}-${hex(trail, TRACE_BYTES)}-${hex(`run:${runId}`, SPAN_BYTES)}-${SAMPLED}`;

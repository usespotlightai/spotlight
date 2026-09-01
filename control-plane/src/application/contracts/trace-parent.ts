import { createHash } from 'node:crypto';

/** The only version the format has, and a flag saying it is worth recording. */
const VERSION = '00';
const SAMPLED = '01';

const hex = (of: string, bytes: number): string =>
  createHash('sha256').update(of).digest('hex').slice(0, bytes * 2);

/**
 * How a run names itself to whatever tracing its harness does of its own.
 *
 * Derived rather than stored: a second attempt at the same run must name itself
 * the same way, and nothing in Spotlight needs to remember it. The trace is the
 * task's, so every run that worked it lands in one; the span is the run's, so
 * what the harness reports hangs off the right one.
 */
export const traceParentFor = (taskId: string, runId: string): string =>
  `${VERSION}-${hex(`task:${taskId}`, 16)}-${hex(`run:${runId}`, 8)}-${SAMPLED}`;

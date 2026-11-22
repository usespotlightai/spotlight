import type {
  AssistFailureReason,
  AssistState,
} from '@assist/application/ports/assist-sessions.port';
import {
  SESSION_WAITING,
  type SessionFailed,
  type SessionFailureCode,
  type SessionWaiting,
} from '@insights/application/ports/session-outcomes';
import type { JsonSchema } from '@platform/json/json-schema';

/**
 * What a failed session means for a judging. A session with nowhere to run, because the team has no harness or the
 * run it is based on belongs to another workspace, is unavailable and never retried; a session whose run failed is
 * tried again in a new round; one that ended without a result fits no verdict.
 */
const FAILURE_OF: Readonly<Record<AssistFailureReason, SessionFailureCode>> = {
  'no-harness': 'unavailable',
  'base-run-elsewhere': 'unavailable',
  'run-failed': 'request-failed',
  'no-result': 'unreadable',
};

export interface SessionResult<T> {
  readonly status: 'submitted';
  readonly result: T;
  /** The harness and model the session ran on. */
  readonly model: string;
}

/** Reads a session's state: its result as the schema parses it, with the model it ran on, or why it has none. */
export const resultOf = <T>(
  state: AssistState,
  schema: JsonSchema<T>,
): SessionResult<T> | SessionFailed | SessionWaiting => {
  if (state.status === 'waiting') {
    return SESSION_WAITING;
  }

  if (state.status === 'failed') {
    return { status: 'failed', failure: FAILURE_OF[state.reason] };
  }

  const parsed = schema.schema.safeParse(state.result);

  return parsed.success
    ? { status: 'submitted', result: parsed.data, model: state.model }
    : { status: 'failed', failure: 'unreadable' };
};

export const evidenceFile = (evidence: unknown): string =>
  `${JSON.stringify(evidence, null, 2)}\n`;

export const SUBMITTING = `When you are done, write your answer as one JSON value to a file and submit it with \`spotlight submit <file>\`. If it reports field errors, fix them and submit again. Your work ends with an accepted submission.`;

export const WORKING_COPY = `Your working copy is a checkout of the team's repository. You may read it and run its tests to check what the evidence shows. Do not change, commit or push any file.`;

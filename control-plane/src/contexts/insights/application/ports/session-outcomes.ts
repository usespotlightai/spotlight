import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';

/** What a port answers while the session it ordered has not settled: the job waits and asks again. */
export interface SessionWaiting {
  readonly status: 'waiting';
}

export const SESSION_WAITING: SessionWaiting = { status: 'waiting' };

/** How a judging session that failed counts for the judging: never retried when it had nowhere to run. */
export type SessionFailureCode = Extract<
  JudgingFailureCode,
  'unavailable' | 'request-failed' | 'unreadable'
>;

/** What a port answers when the session it ordered failed, or submitted a result it cannot read. */
export interface SessionFailed {
  readonly status: 'failed';
  readonly failure: SessionFailureCode;
}

/** A session that stopped waiting, named the way the assist context publishes it. */
export interface SettledSession {
  readonly workspaceId: string;
  readonly purpose: string;
  readonly key: string;
}

const isWaiting = <T extends { readonly status: string }>(
  answer: T | SessionWaiting,
): answer is SessionWaiting => answer.status === 'waiting';

/**
 * Decides a round of several sessions once every one of them is ordered: the round waits while any session waits,
 * and goes on with every answer once none does.
 */
export const allSettled = <T extends { readonly status: string }>(
  answers: readonly (T | SessionWaiting)[],
): readonly Exclude<T, SessionWaiting>[] | SessionWaiting => {
  const settled = answers.filter(
    (each): each is Exclude<T, SessionWaiting> => !isWaiting(each),
  );

  return settled.length === answers.length ? settled : SESSION_WAITING;
};

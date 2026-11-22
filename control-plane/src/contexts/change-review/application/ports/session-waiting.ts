/** What a port answers while the assist session it ordered has not settled: the job waits and asks again. */
export interface SessionWaiting {
  readonly status: 'waiting';
}

export const SESSION_WAITING: SessionWaiting = { status: 'waiting' };

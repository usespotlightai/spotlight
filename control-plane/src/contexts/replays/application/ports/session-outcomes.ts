/** What a port answers while the judging session it ordered has not settled: the job waits and asks again. */
export interface SessionWaiting {
  readonly status: 'waiting';
}

export const SESSION_WAITING: SessionWaiting = { status: 'waiting' };

/** A judging session that stopped waiting, named the way it was published. */
export interface SettledSession {
  readonly workspaceId: string;
  readonly purpose: string;
  readonly key: string;
}

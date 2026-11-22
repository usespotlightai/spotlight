export const ASSIST_SESSION_SETTLED = 'assist.session-settled.v1';

type AssistSessionOutcomePublished = 'submitted' | 'failed';

/** A session stopped waiting: its result counts now, or it failed. Its orderer reads the state again. */
export type AssistSessionSettledIntegrationEvent = {
  readonly kind: typeof ASSIST_SESSION_SETTLED;
  readonly workspaceId: string;
  readonly purpose: string;
  readonly key: string;
  readonly outcome: AssistSessionOutcomePublished;
};

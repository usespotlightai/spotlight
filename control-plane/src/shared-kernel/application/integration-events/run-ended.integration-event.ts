export const RUN_ENDED = 'runs.run-ended.v1';

export type RunEndingPublished = 'completed' | 'exhausted' | 'cancelled';

export type RunOutcomePublished =
  | 'completed'
  | 'failed'
  | 'exhausted'
  | 'cancelled';

export type RunRequesterPublished = {
  readonly owner: string;
  readonly kind: string;
  readonly id: string;
  readonly token: string | null;
  readonly team: string | null;
};

type HandedOverFilePublished = {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
};

export type RunEndedIntegrationEvent = {
  readonly kind: typeof RUN_ENDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly requester: RunRequesterPublished;
  readonly attempt: number;
  readonly ending: RunEndingPublished;
  readonly outcome: RunOutcomePublished;
  readonly failure: string | null;
  readonly exitCode: number | null;
  readonly message: string | null;
  readonly stopped: boolean;
  readonly started: boolean;
  readonly askedAPerson: boolean;
  readonly handsOver: boolean;
  readonly reported: boolean;
  readonly report: {
    readonly next: string | null;
    readonly note: string | null;
    readonly files: readonly HandedOverFilePublished[];
  } | null;
  readonly session: string | null;
  readonly claimedBy: string | null;
  readonly expiredLeases: number;
  readonly endedAt: string;
};

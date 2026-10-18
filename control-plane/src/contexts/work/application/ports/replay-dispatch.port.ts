import type { UnreplayableReasonCode } from '@work/application/contracts/unreplayable-reason.contract';

export const REPLAY_DISPATCH = Symbol('REPLAY_DISPATCH');

export type ReplayAnswer = 'accepted' | 'sent-back';

export interface ReplayOrder {
  readonly id: string;
  readonly original: string;
  readonly workspaceId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly station: unknown;
  readonly repositories?: unknown;
  readonly answer?: ReplayAnswer | null;
}

export type ReplayDispatched =
  | { readonly outcome: 'queued'; readonly fingerprint: string | null }
  | {
      readonly outcome: 'unreplayable';
      readonly unreplayableReason: UnreplayableReasonCode;
      readonly reason: string;
    };

export type CancelledReplayRun =
  | { readonly outcome: 'never-queued' }
  | { readonly outcome: 'queued'; readonly fingerprint: string | null };

export interface AnswerInput {
  readonly original: string;
  readonly answer: ReplayAnswer;
}

export interface ReplayDispatchPort {
  enqueue(order: ReplayOrder): Promise<ReplayDispatched>;

  answerable(inputs: readonly AnswerInput[]): Promise<readonly string[]>;

  cancelQueued(runIds: readonly string[]): Promise<void>;

  cancel(runId: string, leaveRunAsIs: boolean): Promise<CancelledReplayRun>;
}

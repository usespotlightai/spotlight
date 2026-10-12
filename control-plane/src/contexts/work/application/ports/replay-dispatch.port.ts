import type { ReplayRefusalCode } from '@work/application/contracts/replay-refusal.contract';

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
      readonly refusal: ReplayRefusalCode;
      readonly reason: string;
    };

export type ReplayForgone =
  | { readonly outcome: 'never-queued' }
  | { readonly outcome: 'queued'; readonly fingerprint: string | null };

export interface AnswerAsked {
  readonly original: string;
  readonly answer: ReplayAnswer;
}

export interface ReplayDispatchPort {
  enqueue(order: ReplayOrder): Promise<ReplayDispatched>;

  answerable(asked: readonly AnswerAsked[]): Promise<readonly string[]>;

  withdraw(runIds: readonly string[]): Promise<void>;

  forgo(runId: string, keep: boolean): Promise<ReplayForgone>;
}

import type { ReplayRefusalCode } from '@work/application/contracts/replay-refusal.contract';

export const REPLAY_DISPATCH = Symbol('REPLAY_DISPATCH');

export interface ReplayOrder {
  readonly id: string;
  readonly original: string;
  readonly workspaceId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly station: unknown;
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

export interface ReplayDispatchPort {
  enqueue(order: ReplayOrder): Promise<ReplayDispatched>;

  withdraw(runIds: readonly string[]): Promise<void>;

  forgo(runId: string, keep: boolean): Promise<ReplayForgone>;
}

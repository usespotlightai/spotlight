import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import type { UntrialableReasonCode } from '@work/application/contracts/untrialable-reason.contract';

export const STATION_TRIALS = Symbol('STATION_TRIALS');

const TRIAL_FOLLOW_UPS = ['accepted', 'sent-back'] as const;

export type TrialFollowUp = (typeof TRIAL_FOLLOW_UPS)[number];

export interface TrialFollowUps {
  readonly accepted: boolean;
  readonly sentBack: boolean;
}

export interface TrialRequest {
  readonly runId: string;
  readonly basedOn: string;
  readonly workspaceId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly config: unknown;
  readonly repositories?: unknown;
  readonly followUp: TrialFollowUp | null;
}

export type TrialOrder = Omit<
  RunOrderContract,
  'requester' | 'policy' | 'workspace' | 'extensions' | 'apiGrant' | 'tags'
> & { readonly team: string };

export interface TrialCheckout {
  readonly path: string;
  readonly repository: string;
  readonly commit: string;
}

export type TrialOrdering =
  | {
      readonly outcome: 'ordered';
      readonly order: TrialOrder;
      readonly fingerprint: string | null;
      readonly checkouts: readonly TrialCheckout[];
      readonly movesOnAfter: readonly string[];
    }
  | {
      readonly outcome: 'untrialable';
      readonly reason: UntrialableReasonCode;
      readonly description: string;
    };

export interface StationTrialsPort {
  followUpsOf(basedOn: string): Promise<TrialFollowUps | null>;

  order(request: TrialRequest): Promise<TrialOrdering>;

  withdraw(runId: string): Promise<void>;
}

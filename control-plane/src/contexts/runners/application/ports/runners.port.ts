import type { AdmittedWay } from '@runners/application/ports/runner-admissions.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const RUNNERS = Symbol('RUNNERS');

export interface HeldWork {
  readonly kind: 'run' | 'check';
  readonly id: string;
}

export type StartedRunner =
  | {
      readonly outcome: 'started';
      readonly runnerId: RunnerId;
      readonly token: string;
      readonly egressToken: string;
    }
  | { readonly outcome: 'full' }
  | { readonly outcome: 'gone' }
  | { readonly outcome: 'stranger' }
  | { readonly outcome: 'unoffered' };

export interface ProvisionRequest {
  readonly poolId: string;
  readonly runnerId: RunnerId;
  readonly work: HeldWork;
  readonly runId: string;
  readonly taskId: string | null;
  readonly labels: readonly string[];
  readonly image: string | null;
  readonly needsEgress: boolean;
  readonly claimBy: Date;
}

type ProvisionFailureKind =
  | 'unreachable'
  | 'refused'
  | 'not-allowed'
  | 'unusable';

export type ProvisionedRunner =
  | { readonly outcome: 'provisioned' }
  | { readonly outcome: 'full' }
  | { readonly outcome: 'gone' }
  | {
      readonly outcome: 'failed';
      readonly kind: ProvisionFailureKind;
      readonly detail: string;
    };

export interface RunnersPort {
  start(
    way: AdmittedWay,
    host: string,
    image: string,
    at: Date,
    claimBy: Date,
  ): Promise<StartedRunner>;

  reports(way: AdmittedWay, host: string): Promise<boolean>;

  provision(request: ProvisionRequest, at: Date): Promise<ProvisionedRunner>;

  took(runnerId: RunnerId, work: HeldWork, at: Date): Promise<void>;

  letGo(runnerId: RunnerId, at: Date): Promise<void>;

  reservationDropped(runnerId: RunnerId, at: Date): Promise<void>;

  workEnded(work: HeldWork, at: Date): Promise<void>;
}

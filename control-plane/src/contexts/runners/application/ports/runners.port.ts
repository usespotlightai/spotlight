import type { CredentialSourceRef } from '@runners/application/ports/runner-authenticator.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const RUNNERS = Symbol('RUNNERS');

export interface LeasedWork {
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
  | { readonly outcome: 'host-unreported' }
  | { readonly outcome: 'image-unreported' };

export interface ProvisionRequest {
  readonly poolId: string;
  readonly runnerId: RunnerId;
  readonly work: LeasedWork;
  readonly runId: string;
  readonly taskId: string | null;
  readonly labels: readonly string[];
  readonly image: string | null;
  readonly needsEgress: boolean;
  readonly claimBy: Date;
}

type ProvisionFailureKind =
  | 'unreachable'
  | 'http-error'
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
    source: CredentialSourceRef,
    host: string,
    image: string,
    at: Date,
    claimBy: Date,
  ): Promise<StartedRunner>;

  reports(source: CredentialSourceRef, host: string): Promise<boolean>;

  provision(request: ProvisionRequest, at: Date): Promise<ProvisionedRunner>;

  claim(runnerId: RunnerId, work: LeasedWork, at: Date): Promise<void>;

  release(runnerId: RunnerId, at: Date): Promise<void>;

  reservationDropped(runnerId: RunnerId, at: Date): Promise<void>;

  workEnded(work: LeasedWork, at: Date): Promise<void>;
}

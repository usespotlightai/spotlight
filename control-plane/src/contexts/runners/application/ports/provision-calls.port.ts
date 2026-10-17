import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';

export const PROVISION_CALLS = Symbol('PROVISION_CALLS');

export interface ProvisionEgress {
  readonly url: string;
  readonly credential: string;
  readonly traffic: 'all' | 'bound';
}

export interface ProvisionCall {
  readonly url: ProvisionUrl;
  readonly secret: ProvisionSecret;
  readonly attempt: string;
  readonly at: Date;
  readonly pool: string;
  readonly workspaceId: string;
  readonly kind: 'run' | 'check';
  readonly stackId: string | null;
  readonly runId: string;
  readonly taskId: string | null;
  readonly labels: readonly string[];
  readonly image: string | null;
  readonly runnerId: string;
  readonly token: string;
  readonly claimBy: Date;
  readonly egress: ProvisionEgress | null;
}

export type ProvisionAnswer =
  | { readonly outcome: 'accepted' }
  | {
      readonly outcome: 'unreachable' | 'http-error' | 'not-allowed';
      readonly detail: string;
    };

export interface ProvisionCallsPort {
  call(call: ProvisionCall): Promise<ProvisionAnswer>;
}

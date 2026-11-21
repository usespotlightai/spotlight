import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { ProvisionFailureKind } from '@shared-kernel/domain/value-objects/provision-failure.vo';

export const PROVISION_CALLS = Symbol('PROVISION_CALLS');

export interface ProvisionEgress {
  readonly url: string;
  readonly credential: string;
  readonly traffic: 'all' | 'bound';
}

export type ProvisionedWork =
  | { readonly kind: 'run'; readonly runId: string }
  | {
      readonly kind: 'check';
      readonly stackId: string;
      readonly runId: string | null;
    }
  | { readonly kind: 'diff'; readonly diffId: string };

// Who gives the provisioner: the workspace for its own pools, the deployment for the platform pool.
export type ProvisionerOwner = 'workspace' | 'deployment';

export interface ProvisionCall {
  readonly owner: ProvisionerOwner;
  readonly url: ProvisionUrl;
  readonly secret: ProvisionSecret;
  readonly messageId: string;
  readonly at: Date;
  readonly pool: string;
  readonly workspaceId: string;
  readonly work: ProvisionedWork;
  readonly tags: Readonly<Record<string, string>>;
  readonly labels: readonly string[];
  readonly image: string | null;
  readonly runnerId: string;
  readonly token: string;
  readonly claimBy: Date;
  readonly egress: ProvisionEgress | null;
}

export type ProvisionCallFailureKind = Extract<
  ProvisionFailureKind,
  'unreachable' | 'http-error' | 'not-allowed' | 'declined'
>;

export type ProvisionAnswer =
  | { readonly outcome: 'accepted' }
  | { readonly outcome: 'full' }
  | {
      readonly outcome: ProvisionCallFailureKind;
      readonly detail: string;
    };

export interface ProvisionCallsPort {
  call(call: ProvisionCall): Promise<ProvisionAnswer>;
}

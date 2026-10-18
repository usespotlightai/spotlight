import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_AUTHENTICATOR = Symbol('RUNNER_AUTHENTICATOR');

export interface HostCredentials {
  readonly bearer: string | undefined;
  readonly trust: string | undefined;
}

export type CredentialSourceKind = 'pool' | 'trust';

export interface CredentialSourceRef {
  readonly kind: CredentialSourceKind;
  readonly id: string;
}

export interface AuthenticatedHost {
  readonly source: CredentialSourceRef;
  readonly workspaceId: WorkspaceId;
}

export interface RunnerAuthenticatorPort {
  authenticate(credential: HostCredentials): Promise<AuthenticatedHost | null>;
}

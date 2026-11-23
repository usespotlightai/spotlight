import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_AUTHENTICATOR = Symbol('RUNNER_AUTHENTICATOR');

export interface HostCredentials {
  readonly bearer: string | undefined;
  readonly trust: string | undefined;
}

type CredentialSourceKind = 'pool' | 'trust';

export interface CredentialSourceRef {
  readonly kind: CredentialSourceKind;
  readonly id: string;
}

export interface AuthenticatedHost {
  readonly source: CredentialSourceRef;
  readonly workspaceId: WorkspaceId;
  // Where the hosts of the pool or trust keep the working copies of runs; null when Spotlight keeps them as archives.
  readonly workingCopies?: WorkingCopyStoreContract | null;
}

export interface RunnerAuthenticatorPort {
  authenticate(credential: HostCredentials): Promise<AuthenticatedHost | null>;
}

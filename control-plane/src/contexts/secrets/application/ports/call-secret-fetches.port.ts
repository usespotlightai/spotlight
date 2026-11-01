import type { FetchedSecrets } from '@secrets/application/contracts/run-secret-fetch.contract';

export const CALL_SECRET_FETCHES = Symbol('CALL_SECRET_FETCHES');

export interface CallSecretFetch {
  readonly workspaceId: string;
  readonly callId: string;
  readonly secrets: readonly string[];
  readonly recipient: string;
}

export interface CallSecretFetchesPort {
  sealedForCall(request: CallSecretFetch): Promise<FetchedSecrets>;
}

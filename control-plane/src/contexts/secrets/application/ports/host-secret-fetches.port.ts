import type { FetchedSecrets } from '@secrets/application/contracts/run-secret-fetch.contract';

export const HOST_SECRET_FETCHES = Symbol('HOST_SECRET_FETCHES');

export interface HostSecretFetch {
  readonly workspaceId: string;
  readonly secrets: readonly string[];
  readonly recipient: string;
}

export interface HostSecretFetchesPort {
  sealedForHost(request: HostSecretFetch): Promise<FetchedSecrets>;
}

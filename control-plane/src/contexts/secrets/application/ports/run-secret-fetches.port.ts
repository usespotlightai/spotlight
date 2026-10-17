import type {
  FetchedSecrets,
  RunSecretFetch,
} from '@secrets/application/contracts/run-secret-fetch.contract';

export const RUN_SECRET_FETCHES = Symbol('RUN_SECRET_FETCHES');

export interface RunSealed {
  readonly runId: string;
  readonly name: string;
  readonly value: string;
  readonly recipient: string;
}

export interface RunSecretFetchesPort {
  fetchSecrets(request: RunSecretFetch): Promise<FetchedSecrets>;

  sealedFor(sealed: RunSealed): string;
}

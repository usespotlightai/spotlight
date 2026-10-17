import type {
  DeniedSecret,
  FetchedSecret,
} from '@secrets/application/contracts/run-secret-fetch.contract';

export type EgressSecretsDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'waiting' }
  | {
      readonly outcome: 'fetched';
      readonly runId: string | null;
      readonly reaches: readonly string[];
      readonly bound: readonly string[];
      readonly secrets: readonly FetchedSecret[];
      readonly denied: readonly DeniedSecret[];
      readonly spotlightApi: { readonly sealed: string } | null;
    };

export type FetchedEgressSecrets = Extract<
  EgressSecretsDto,
  { readonly outcome: 'fetched' }
>;

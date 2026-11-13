import type {
  DeniedSecret,
  FetchedSecret,
} from '@secrets/application/contracts/run-secret-fetch.contract';

export type HarnessKeysDto =
  | { readonly outcome: 'unauthorized' }
  | {
      readonly outcome: 'fetched';
      readonly bound: readonly string[];
      readonly secrets: readonly FetchedSecret[];
      readonly denied: readonly DeniedSecret[];
    };

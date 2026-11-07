import type {
  DeniedSecret,
  FetchedSecret,
} from '@secrets/application/contracts/run-secret-fetch.contract';

interface HostCallDto {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs: number;
  readonly secretsToken: string | null;
}

export type HostCallClaimDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'nothing' }
  | { readonly outcome: 'host-unreported' }
  | { readonly outcome: 'claimed'; readonly call: HostCallDto };

export type RecordHostCallResponseDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'unknown' }
  | { readonly outcome: 'completed'; readonly reason: string }
  | { readonly outcome: 'not-theirs' }
  | { readonly outcome: 'answered' };

export type RedeemCallSecretsDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'expired'; readonly reason: string }
  | { readonly outcome: 'taken'; readonly reason: string }
  | RedeemedCallSecrets;

export interface RedeemedCallSecrets {
  readonly outcome: 'redeemed';
  readonly callId: string;
  readonly bound: readonly string[];
  readonly secrets: readonly FetchedSecret[];
  readonly denied: readonly DeniedSecret[];
}

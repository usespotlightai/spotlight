import type { FetchedEgressSecrets } from '@work/application/dto/egress-secrets.dto';

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
  | FetchedEgressSecrets;

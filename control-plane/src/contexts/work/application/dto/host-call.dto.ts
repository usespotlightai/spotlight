interface HostCallDto {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs: number;
}

export type HostCallClaimDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'nothing' }
  | { readonly outcome: 'stranger' }
  | { readonly outcome: 'claimed'; readonly call: HostCallDto };

export type HostCallAnswerDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'unknown' }
  | { readonly outcome: 'settled'; readonly reason: string }
  | { readonly outcome: 'not-theirs' }
  | { readonly outcome: 'answered' };

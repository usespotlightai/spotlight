export const NETWORK_CALLS = Symbol('NETWORK_CALLS');

export interface NetworkRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly timeoutMs: number;
}

export interface NetworkAnswer {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly ms: number;
  readonly error: string | null;
}

export type NetworkCallState =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'answered'; readonly answer: NetworkAnswer }
  | { readonly kind: 'lapsed' };

export interface NetworkCallsPort {
  queue(
    workspaceId: string,
    request: NetworkRequest,
    lapsesAt: Date,
  ): Promise<string>;

  stateOf(callId: string): Promise<NetworkCallState>;

  answered(callId: string, until: Date): Promise<NetworkCallState>;
}

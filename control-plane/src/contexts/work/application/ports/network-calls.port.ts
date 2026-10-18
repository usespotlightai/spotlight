export const NETWORK_CALLS = Symbol('NETWORK_CALLS');

export interface NetworkRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly timeoutMs: number;
}

export interface NetworkResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly ms: number;
  readonly error: string | null;
}

export type NetworkCallState =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'answered'; readonly response: NetworkResponse }
  | { readonly kind: 'expired' };

export interface NetworkCallsPort {
  queue(
    workspaceId: string,
    request: NetworkRequest,
    expiresAt: Date,
  ): Promise<string>;

  stateOf(callId: string): Promise<NetworkCallState>;

  answered(callId: string, until: Date): Promise<NetworkCallState>;
}

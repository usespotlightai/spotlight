export const KEY_MANAGEMENT = Symbol('KEY_MANAGEMENT');

export type KeyContext = Readonly<Record<string, string>>;

export interface IssuedDataKey {
  readonly plain: Uint8Array;
  readonly wrapped: string;
}

export interface KeyManagement {
  readonly keyId: string;

  issue(context: KeyContext): Promise<IssuedDataKey>;

  unwrap(wrapped: string, context: KeyContext): Promise<Uint8Array>;
}

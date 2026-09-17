export interface GitHubDelivery {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: unknown;
  readonly raw: Uint8Array | null;
}

export const RUN_TOKENS = Symbol('RUN_TOKENS');

export interface RunTokenWanted {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly issuedBy: string;
  readonly scopes: readonly string[];
  readonly expiresAt: Date;
}

export interface MintedRunToken {
  readonly id: string;
  readonly token: string;
}

export interface RunTokensPort {
  mintFor(wanted: RunTokenWanted): Promise<MintedRunToken>;

  revoke(workspaceId: string, tokenId: string): Promise<void>;

  revokeFor(
    workspaceId: string,
    runId: string,
    attempt: number | null,
  ): Promise<void>;
}

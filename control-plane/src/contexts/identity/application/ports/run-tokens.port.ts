export const RUN_TOKENS = Symbol('RUN_TOKENS');

export interface RunTokenWanted {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly issuedBy: string;
  readonly scopes: readonly string[];
  readonly expiresAt: Date;
}

export interface IssuedRunToken {
  readonly id: string;
  readonly token: string;
}

export interface RunTokensPort {
  issueFor(wanted: RunTokenWanted): Promise<IssuedRunToken>;

  revoke(workspaceId: string, tokenId: string): Promise<void>;

  revokeFor(
    workspaceId: string,
    runId: string,
    attempt: number | null,
  ): Promise<void>;
}

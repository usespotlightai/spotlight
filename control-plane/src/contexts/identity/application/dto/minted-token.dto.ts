export interface MintedTokenDto {
  readonly token: string;
  readonly tokenId: string;
  readonly workspaceId: string;
  readonly scopes: readonly string[];
  readonly expiresAt: string;
}

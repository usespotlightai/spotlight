export interface IssuedTokenDto {
  readonly token: string;
  readonly tokenId: string;
  readonly workspaceId: string;
  readonly scopes: readonly string[];
  readonly expiresAt: string;
}

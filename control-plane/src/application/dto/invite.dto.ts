export interface InviteDto {
  readonly id: string;
  readonly email: string;
  readonly invitedBy: string;
  readonly invitedAt: string;
  readonly expiresAt: string;
}

export interface InviteOfferDto {
  readonly email: string;
  readonly teamName: string;
  readonly workspaceName: string;
  readonly invitedBy: string;
  readonly standing: 'open' | 'accepted' | 'revoked' | 'expired';
}

export interface JoinedTeamDto {
  readonly workspaceSlug: string;
  readonly teamId: string;
  readonly teamName: string;
}

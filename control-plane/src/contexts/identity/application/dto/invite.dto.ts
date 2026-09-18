import type { InviteStatus } from '@identity/domain/aggregates/invite.aggregate';

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
  readonly standing: InviteStatus;
}

export interface JoinedTeamDto {
  readonly workspaceSlug: string;
  readonly teamId: string;
  readonly teamName: string;
}

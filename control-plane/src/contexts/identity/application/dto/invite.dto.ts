import type { PersonSummary } from '@identity/application/ports/person-reader.port';
import type { TeamRef } from '@identity/application/read-models/team-ref';
import type { InviteStatus } from '@identity/domain/aggregates/workspace-invite.aggregate';
import type { InvitableRoleName } from '@identity/domain/value-objects/invite-spec.vo';

export type InviteOutcome =
  | 'invited'
  | 'resent'
  | 'already-a-member'
  | 'not-sent';

export interface InviteOutcomeDto {
  readonly email: string;
  readonly outcome: InviteOutcome;
}

export interface InviteOutcomesDto {
  readonly outcomes: readonly InviteOutcomeDto[];
}

export interface WorkspaceInviteDto {
  readonly id: string;
  readonly email: string;
  readonly role: InvitableRoleName;
  readonly teams: readonly TeamRef[];
  readonly invitedBy: PersonSummary | null;
  readonly invitedAt: string;
  readonly expiresAt: string;
}

export interface InvitePreviewDto {
  readonly email: string;
  readonly workspaceName: string;
  readonly invitedBy: string | null;
  readonly role: InvitableRoleName;
  readonly teamNames: readonly string[];
  readonly status: InviteStatus;
}

export interface JoinedWorkspaceDto {
  readonly workspaceSlug: string;
}

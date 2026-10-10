import type { PersonSummary } from '@identity/application/ports/person-reader.port';
import type { TeamNamed } from '@identity/application/read-models/team-named';
import type { InviteStatus } from '@identity/domain/aggregates/workspace-invite.aggregate';
import type { InvitableRoleName } from '@identity/domain/value-objects/invite-terms.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INVITE_READER = Symbol('INVITE_READER');

export interface InviteSummary {
  readonly id: string;
  readonly email: string;
  readonly role: InvitableRoleName;
  readonly teams: readonly TeamNamed[];
  readonly invitedBy: PersonSummary | null;
  readonly invitedAt: Date;
  readonly expiresAt: Date;
}

export interface InviteOffer {
  readonly email: string;
  readonly workspaceName: string;
  readonly invitedBy: string | null;
  readonly role: InvitableRoleName;
  readonly teamNames: readonly string[];
  readonly standing: InviteStatus;
}

export interface InviteReaderPort {
  openInWorkspace(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly InviteSummary[]>;

  withToken(hash: TokenHash, now: Date): Promise<InviteOffer | null>;
}

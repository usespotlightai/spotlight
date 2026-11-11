import { OidcTrustCreated } from '@identity/domain/events/oidc-trust-created.event';
import { OidcTrustDeleted } from '@identity/domain/events/oidc-trust-deleted.event';
import { OidcTrustUpdated } from '@identity/domain/events/oidc-trust-updated.event';
import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import { TeamMemberJoined } from '@identity/domain/events/team-member-joined.event';
import { TeamUpdated } from '@identity/domain/events/team-updated.event';
import { UserEmailAdded } from '@identity/domain/events/user-email-added.event';
import { UserEmailRemoved } from '@identity/domain/events/user-email-removed.event';
import { UserEmailVerified } from '@identity/domain/events/user-email-verified.event';
import { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import { WorkspaceInviteCreated } from '@identity/domain/events/workspace-invite-created.event';
import { WorkspaceInviteRevoked } from '@identity/domain/events/workspace-invite-revoked.event';
import { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import { WorkspaceMemberRoleChanged } from '@identity/domain/events/workspace-member-role-changed.event';
import { WorkspaceTokenExpired } from '@identity/domain/events/workspace-token-expired.event';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { WorkspaceTokenUpdated } from '@identity/domain/events/workspace-token-updated.event';
import { WorkspaceUpdated } from '@identity/domain/events/workspace-updated.event';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { IssuedTokenDetail } from '@identity/domain/value-objects/issued-token-detail.vo';
import { IssuedTokenGrant } from '@identity/domain/value-objects/issued-token-grant.vo';
import { JobFunction } from '@identity/domain/value-objects/job-function.vo';
import { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { RunTokenDetail } from '@identity/domain/value-objects/run-token-detail.vo';
import { SignupSurvey } from '@identity/domain/value-objects/signup-survey.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenScope } from '@identity/domain/value-objects/token-scope.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';

export const IDENTITY_PAYLOAD_TYPES = [
  EmailAddress,
  InviteId,
  InviteSpec,
  IssuedTokenDetail,
  IssuedTokenGrant,
  OidcTrustId,
  TokenScope,
  TokenScopes,
  WorkspaceTokenId,
  JobFunction,
  RunTokenDetail,
  SignupSurvey,
  TeamKey,
  TeamName,
  TokenName,
  OidcTrustKey,
  UserEmailId,
  WorkspaceName,
  WorkspaceRole,
  WorkspaceSlug,
  TeamCreated,
  TeamDeleted,
  TeamMemberJoined,
  TeamUpdated,
  WorkspaceDeleted,
  WorkspaceInviteAccepted,
  WorkspaceInviteCreated,
  WorkspaceInviteRevoked,
  WorkspaceMemberJoined,
  WorkspaceMemberRoleChanged,
  WorkspaceCreated,
  WorkspaceUpdated,
  WorkspaceTokenIssued,
  WorkspaceTokenExpired,
  WorkspaceTokenUpdated,
  WorkspaceTokenRevoked,
  UserEmailAdded,
  UserEmailVerified,
  UserEmailRemoved,
  OidcTrustCreated,
  OidcTrustUpdated,
  OidcTrustDeleted,
] as const;

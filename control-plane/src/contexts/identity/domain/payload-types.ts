import { OidcTrustCreated } from '@identity/domain/events/oidc-trust-created.event';
import { OidcTrustDeleted } from '@identity/domain/events/oidc-trust-deleted.event';
import { OidcTrustUpdated } from '@identity/domain/events/oidc-trust-updated.event';
import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import { TeamMemberJoined } from '@identity/domain/events/team-member-joined.event';
import { TeamUpdated } from '@identity/domain/events/team-updated.event';
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
import { ClaimPattern } from '@identity/domain/value-objects/claim-pattern.vo';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { IssuedTokenDetail } from '@identity/domain/value-objects/issued-token-detail.vo';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import { RunTokenDetail } from '@identity/domain/value-objects/run-token-detail.vo';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';

export const IDENTITY_PAYLOAD_TYPES = [
  ClaimPattern,
  Permissions,
  EmailAddress,
  ScopeCeiling,
  InviteId,
  InviteSpec,
  IssuedTokenDetail,
  RunTokenDetail,
  Dependents,
  TeamKey,
  TeamName,
  TokenDescription,
  TokenLifetime,
  TokenName,
  OidcTrustKey,
  WorkloadRule,
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
  OidcTrustCreated,
  OidcTrustUpdated,
  OidcTrustDeleted,
] as const;

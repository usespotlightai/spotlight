import { InviteAccepted } from '@identity/domain/events/invite-accepted.event';
import { InviteOffered } from '@identity/domain/events/invite-offered.event';
import { InviteRevoked } from '@identity/domain/events/invite-revoked.event';
import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamDisbanded } from '@identity/domain/events/team-disbanded.event';
import { TeamMemberJoined } from '@identity/domain/events/team-member-joined.event';
import { TeamRedefined } from '@identity/domain/events/team-redefined.event';
import { WorkspaceClosed } from '@identity/domain/events/workspace-closed.event';
import { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import { WorkspaceMemberRoleChanged } from '@identity/domain/events/workspace-member-role-changed.event';
import { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import { WorkspaceRedefined } from '@identity/domain/events/workspace-redefined.event';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenLapsed } from '@identity/domain/events/workspace-token-lapsed.event';
import { WorkspaceTokenRedescribed } from '@identity/domain/events/workspace-token-redescribed.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { WorkspaceTokenTrustDefined } from '@identity/domain/events/workspace-token-trust-defined.event';
import { WorkspaceTokenTrustRedefined } from '@identity/domain/events/workspace-token-trust-redefined.event';
import { WorkspaceTokenTrustWithdrawn } from '@identity/domain/events/workspace-token-trust-withdrawn.event';
import { ClaimPattern } from '@identity/domain/value-objects/claim-pattern.vo';
import { Clearance } from '@identity/domain/value-objects/clearance.vo';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { Holdings } from '@identity/domain/value-objects/holdings.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { MintedTokenDetail } from '@identity/domain/value-objects/minted-token-detail.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';

export const IDENTITY_EVENT_TYPES = [
  ClaimPattern,
  Clearance,
  EmailAddress,
  InviteId,
  MintedTokenDetail,
  Holdings,
  TeamKey,
  TeamName,
  TokenDescription,
  TokenLifetime,
  TokenName,
  TokenTrustKey,
  WorkloadRule,
  WorkspaceName,
  WorkspaceRole,
  WorkspaceSlug,
  InviteAccepted,
  InviteOffered,
  InviteRevoked,
  TeamCreated,
  TeamDisbanded,
  TeamMemberJoined,
  TeamRedefined,
  WorkspaceClosed,
  WorkspaceMemberJoined,
  WorkspaceMemberRoleChanged,
  WorkspaceOpened,
  WorkspaceRedefined,
  WorkspaceTokenIssued,
  WorkspaceTokenLapsed,
  WorkspaceTokenRedescribed,
  WorkspaceTokenRevoked,
  WorkspaceTokenTrustDefined,
  WorkspaceTokenTrustRedefined,
  WorkspaceTokenTrustWithdrawn,
] as const;

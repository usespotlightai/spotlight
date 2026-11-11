import { readdirSync } from 'node:fs';
import { join } from 'node:path';

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
import { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { RunTokenDetail } from '@identity/domain/value-objects/run-token-detail.vo';
import { SignupSurvey } from '@identity/domain/value-objects/signup-survey.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import { IDENTITY_PAYLOAD_TYPES } from '@identity/infrastructure/events/identity-payload-types';
import { EventCodec } from '@platform/events/event-codec';
import { PayloadTypes } from '@platform/events/payload-types';
import { SHARED_KERNEL_PAYLOAD_TYPES } from '@platform/events/shared-kernel-payload-types';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const USER = UserId.of('user_1');
const TEAM = TeamId.of('team_1');
const TRUST = OidcTrustId.of('trust_1');
const TOKEN = WorkspaceTokenId.of('token_1');
const INVITE = InviteId.of('invite_1');
const EMAIL = EmailAddress.of('ada@acme.test');
const EMAIL_ID = UserEmailId.of('email_1');
const SPEC = InviteSpec.of(WorkspaceRole.member, [TEAM]);
const AT = new Date('2026-11-07T10:00:00.000Z');
const BY = changeActorIn(WORKSPACE);
const BY_TOKEN = changeActorIn(
  WORKSPACE,
  Actor.of(
    IssuedTokenGrant.principal({
      tokenId: TOKEN,
      workspaceId: WORKSPACE,
      scopes: TokenScopes.named(['configure']),
      issuedBy: USER,
      issuedByTrustId: TRUST,
    }),
    Client.named('terraform-provider/1.0.0'),
  ),
);
const changed = { resource: 'team' as const, id: 'team_1', key: 'core' };

const typesIn = (encoded: unknown): readonly string[] => {
  if (Array.isArray(encoded)) {
    return encoded.flatMap(typesIn);
  }

  if (typeof encoded !== 'object' || encoded === null) {
    return [];
  }

  return Object.entries(encoded).flatMap(([key, each]) =>
    key === '$type' && typeof each === 'string' ? [each] : typesIn(each),
  );
};

const EVERY_EVENT: readonly DomainEvent[] = [
  new OidcTrustCreated(
    TRUST,
    WORKSPACE,
    OidcTrustKey.of('ci'),
    ConfigurationChange.created(changed, BY),
  ),
  new OidcTrustUpdated(
    TRUST,
    WORKSPACE,
    OidcTrustKey.of('ci'),
    ConfigurationChange.updated(changed, BY),
  ),
  new OidcTrustDeleted(
    TRUST,
    WORKSPACE,
    OidcTrustKey.of('ci'),
    ConfigurationChange.deleted(changed, BY),
  ),
  new TeamCreated(
    WORKSPACE,
    TEAM,
    USER,
    'configuration',
    ConfigurationChange.created(changed, BY),
  ),
  new TeamUpdated(
    WORKSPACE,
    TEAM,
    TeamKey.of('core'),
    ConfigurationChange.updated(changed, BY),
  ),
  new TeamDeleted(
    WORKSPACE,
    TEAM,
    TeamKey.of('core'),
    ConfigurationChange.deleted(changed, BY),
  ),
  new TeamMemberJoined(TEAM, USER),
  new UserEmailAdded(EMAIL_ID, USER, EMAIL),
  new UserEmailVerified(EMAIL_ID, USER, EMAIL),
  new UserEmailRemoved(EMAIL_ID, USER, EMAIL),
  new WorkspaceCreated(
    WORKSPACE,
    USER,
    { id: TEAM, name: TeamName.of('Core') },
    ConfigurationChange.created(changed, BY),
    SignupSurvey.of({ jobFunction: 'engineering', referralSource: null }),
  ),
  new WorkspaceUpdated(
    WORKSPACE,
    WorkspaceName.of('Acme'),
    ConfigurationChange.updated(changed, BY),
  ),
  new WorkspaceDeleted(
    WORKSPACE,
    WorkspaceSlug.of('acme'),
    ConfigurationChange.deleted(changed, BY),
  ),
  new WorkspaceInviteCreated(INVITE, WORKSPACE, EMAIL, SPEC, USER, false),
  new WorkspaceInviteAccepted(INVITE, WORKSPACE, SPEC, USER),
  new WorkspaceInviteRevoked(INVITE, WORKSPACE, EMAIL, USER),
  new WorkspaceMemberJoined(WORKSPACE, USER, WorkspaceRole.member),
  new WorkspaceMemberRoleChanged(
    WORKSPACE,
    USER,
    WorkspaceRole.member,
    WorkspaceRole.admin,
    USER,
  ),
  new WorkspaceTokenIssued(
    TOKEN,
    WORKSPACE,
    TokenName.of('ci'),
    ConfigurationChange.created(
      changed,
      BY,
      IssuedTokenDetail.of({
        issuedByTrustId: TRUST,
        subject: 'repo:acme/app:ref:refs/heads/main',
        scopes: ['plan'],
        expiresAt: AT,
      }),
    ),
    TRUST,
    AT,
  ),
  new WorkspaceTokenIssued(
    TOKEN,
    WORKSPACE,
    TokenName.of('run-token-1'),
    ConfigurationChange.created(
      changed,
      BY,
      RunTokenDetail.of({
        runId: RunId.of('run_1'),
        attempt: 1,
        scopes: ['plan'],
        expiresAt: AT,
      }),
    ),
    null,
    AT,
  ),
  new WorkspaceTokenUpdated(
    TOKEN,
    WORKSPACE,
    TokenName.of('ci'),
    ConfigurationChange.updated(changed, BY_TOKEN),
  ),
  new WorkspaceTokenRevoked(
    TOKEN,
    WORKSPACE,
    TokenName.of('ci'),
    ConfigurationChange.deleted(changed, BY),
  ),
  new WorkspaceTokenExpired(TOKEN, WORKSPACE, TokenName.of('ci')),
];

describe('IDENTITY_PAYLOAD_TYPES', () => {
  const types = new PayloadTypes();

  types.register('shared-kernel', SHARED_KERNEL_PAYLOAD_TYPES);
  types.register('identity', IDENTITY_PAYLOAD_TYPES);

  const codec = new EventCodec(types);

  it('holds every class an identity event carries, and nothing else', () => {
    const carried = new Set(
      EVERY_EVENT.flatMap((event) => typesIn(codec.encode(event))),
    );

    expect(
      IDENTITY_PAYLOAD_TYPES.map((type) => `identity.${type.name}`).filter(
        (name) => !carried.has(name),
      ),
    ).toEqual([]);
  });

  it('holds every identity event, and builds each one here', async () => {
    const folder = join(__dirname, '..', '..', 'domain', 'events');
    const events: unknown[] = [];

    for (const file of readdirSync(folder).filter(
      (each) => each.endsWith('.ts') && !each.endsWith('.spec.ts'),
    )) {
      const loaded = (await import(join(folder, file))) as Record<
        string,
        unknown
      >;

      events.push(
        ...Object.values(loaded).filter(
          (value) =>
            typeof value === 'function' && /^class\s/.test(value.toString()),
        ),
      );
    }

    const built = new Set(EVERY_EVENT.map((event) => event.constructor));

    expect(events.filter((each) => !built.has(each as never))).toEqual([]);
  });

  it('reads back every identity event as it was written', () => {
    for (const event of EVERY_EVENT) {
      expect(codec.decode(codec.encode(event))).toEqual(event);
    }
  });
});

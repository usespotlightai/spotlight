import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { BearerAdmission } from '@identity/domain/services/bearer-admission';
import { Grantor } from '@identity/domain/value-objects/grantor.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-25T10:00:00.000Z');
const LATER = new Date('2026-09-25T10:20:00.000Z');
const ISSUER = 'https://token.actions.githubusercontent.com';
const MAIN = 'repo:acme/platform:ref:refs/heads/main';

const trustAt = (version: number) =>
  WorkspaceTokenTrust.rehydrate({
    id: WorkspaceTokenTrustId.of('trust_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TokenTrustKey.of('github-main'),
    workload: WorkloadRule.of({
      issuer: ISSUER,
      audience: 'spotlight',
      subject: MAIN,
      claims: {},
    }),
    scopes: TokenScopes.named(['configure']),
    lifetime: TokenLifetime.ofMinutes(15),
    definedBy: UserId.of('admin_1'),
    version,
  });

const MINTED = trustAt(1).mintFor(
  { issuer: ISSUER, subject: MAIN, audiences: ['spotlight'], named: {} },
  {
    id: WorkspaceTokenId.of('token_1'),
    hash: TokenHash.of('d'.repeat(64)),
    now: NOW,
    client: Client.named('web'),
  },
);

const ISSUED = WorkspaceToken.issue({
  id: WorkspaceTokenId.of('token_2'),
  workspaceId: WorkspaceId.of('ws_1'),
  name: TokenName.of('ci'),
  description: TokenDescription.of(''),
  scopes: TokenScopes.named(['plan']),
  expiresAt: null,
  hash: TokenHash.of('e'.repeat(64)),
  issuedBy: UserId.of('admin_1'),
  now: NOW,
  by: attributedIn('ws_1'),
});

const FOR_RUN = WorkspaceToken.forRun({
  id: WorkspaceTokenId.of('token_3'),
  workspaceId: WorkspaceId.of('ws_1'),
  name: TokenName.of('run-token-3'),
  scopes: TokenScopes.named(['plan']),
  hash: TokenHash.of('f'.repeat(64)),
  issuedBy: UserId.of('user_1'),
  runId: RunId.of('run_1'),
  attempt: 1,
  expiresAt: LATER,
  now: NOW,
});

describe('BearerAdmission', () => {
  it('admits a token minted for a run until it ends or is revoked, needing no trust', () => {
    expect(BearerAdmission.admits(FOR_RUN, null, NOW)).toBe(true);
    expect(BearerAdmission.admits(FOR_RUN, null, LATER)).toBe(false);
    expect(
      BearerAdmission.admits(FOR_RUN.revoke(attributedIn('ws_1')), null, NOW),
    ).toBe(false);
  });

  it('admits a token issued by hand while it stands, needing no trust', () => {
    expect(BearerAdmission.admits(ISSUED, null, LATER)).toBe(true);
    expect(
      BearerAdmission.admits(ISSUED.revoke(attributedIn('ws_1')), null, NOW),
    ).toBe(false);
  });

  it('admits a minted token only while its trust stands as it was when it was minted', () => {
    expect(BearerAdmission.admits(MINTED, trustAt(1), NOW)).toBe(true);
    expect(BearerAdmission.admits(MINTED, trustAt(2), NOW)).toBe(false);
    expect(BearerAdmission.admits(MINTED, null, NOW)).toBe(false);
    expect(
      BearerAdmission.admits(
        MINTED,
        trustAt(1).withdraw(Grantor.unlimited, attributedIn('ws_1')),
        NOW,
      ),
    ).toBe(false);
  });

  it('admits no token once it has expired, whatever its trust', () => {
    expect(BearerAdmission.admits(MINTED, trustAt(1), LATER)).toBe(false);
  });
});

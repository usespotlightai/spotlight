import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { WorkspaceTokenExpired } from '@identity/domain/events/workspace-token-expired.event';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import { TokenTrustVersionConflictError } from '@identity/domain/exceptions/token-trust-version-conflict.error';
import { WorkloadNotMatchedError } from '@identity/domain/exceptions/workload-not-matched.error';
import { Grantor } from '@identity/domain/value-objects/grantor.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-25T10:00:00.000Z');
const ID = WorkspaceTokenTrustId.of('trust_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const ADMIN = UserId.of('admin_1');
const BY = attributedIn('ws_1');
const ISSUER = 'https://token.actions.githubusercontent.com';
const MAIN = 'repo:acme/platform:ref:refs/heads/main';

const terms = (
  over: Partial<{ key: string; scopes: string[]; minutes: number }> = {},
) => ({
  key: TokenTrustKey.of(over.key ?? 'github-main'),
  workload: WorkloadRule.of({
    issuer: ISSUER,
    audience: 'spotlight',
    subject: MAIN,
    claims: {},
  }),
  scopes: TokenScopes.named(over.scopes ?? ['configure', 'secrets']),
  lifetime: TokenLifetime.ofMinutes(over.minutes ?? 15),
});

const stored = (version = 2) =>
  WorkspaceTokenTrust.rehydrate({
    ...terms(),
    id: ID,
    workspaceId: WORKSPACE,
    createdBy: ADMIN,
    version,
  });

const workload = (subject = MAIN): WorkloadClaims => ({
  issuer: ISSUER,
  subject,
  audiences: ['spotlight'],
  named: {},
});

const issuedToken = (trust = stored(), claims = workload()) =>
  trust.issueFor(claims, {
    id: WorkspaceTokenId.of('token_9'),
    hash: TokenHash.of('b'.repeat(64)),
    now: NOW,
    client: Client.named('terraform-provider/0.2.0'),
  });

describe('WorkspaceTokenTrust', () => {
  it('says it was created, by whom, and remembers who created it', () => {
    const created = WorkspaceTokenTrust.create({
      ...terms(),
      id: ID,
      workspaceId: WORKSPACE,
      createdBy: ADMIN,
      grantor: Grantor.unlimited,
      by: BY,
    });

    expect(created.createdBy).toEqual(ADMIN);
    expect(created.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-token-trust.created',
    ]);
  });

  it('issues a token that acts for whoever created it, through the trust, until its lifetime runs out', () => {
    const token = issuedToken();

    expect(token.issuedByTrustId).toEqual(ID);
    expect(token.name.value).toBe('github-main');
    expect(token.scopes.toString()).toBe('configure, secrets');
    expect(token.expiresAt).toEqual(new Date('2026-09-25T10:15:00.000Z'));
    expect(token.principal).toMatchObject({
      userId: ADMIN,
      issuedByTrustId: ID,
    });
    expect(token.isActiveAt(new Date('2026-09-25T10:14:59.000Z'))).toBe(true);
    expect(token.isActiveAt(new Date('2026-09-25T10:15:00.000Z'))).toBe(false);
  });

  it('records the exchange as the issued token itself, naming the trust and the workload', () => {
    const [issued] = issuedToken().pullEvents();

    expect(issued).toBeInstanceOf(WorkspaceTokenIssued);
    expect((issued as WorkspaceTokenIssued).change.by.actor).toMatchObject({
      principal: {
        tokenId: WorkspaceTokenId.of('token_9'),
        issuedByTrustId: ID,
      },
    });
    expect((issued as WorkspaceTokenIssued).change.recordedDetail).toEqual({
      trust: 'trust_1',
      subject: MAIN,
      scopes: ['configure', 'secrets'],
      expiresAt: '2026-09-25T10:15:00.000Z',
    });
  });

  it('issues nothing for a workload it does not match', () => {
    expect(() =>
      issuedToken(stored(), workload('repo:acme/platform:pull_request')),
    ).toThrow(WorkloadNotMatchedError);
  });

  it('still grants a token only while it is the same as when the token was issued', () => {
    const token = issuedToken(stored(2));

    expect(token.trustVersion).toBe(2);
    expect(stored(2).stillGrants(token)).toBe(true);
    expect(stored(3).stillGrants(token)).toBe(false);
    expect(stored(2).delete(Grantor.unlimited, BY).stillGrants(token)).toBe(
      false,
    );
  });

  it('changes nothing, and so cuts no token, when updated to what it already is', () => {
    const trust = stored();

    expect(trust.update(terms(), Grantor.unlimited, BY)).toBe(trust);
    expect(trust.pullEvents()).toEqual([]);
    expect(
      stored()
        .update(terms({ minutes: 5 }), Grantor.unlimited, BY)
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['workspace-token-trust.updated']);
  });

  it('grants no scope beyond those of a token creating or updating it', () => {
    const defining = (scopes: string[]) =>
      WorkspaceTokenTrust.create({
        ...terms(),
        id: ID,
        workspaceId: WORKSPACE,
        createdBy: ADMIN,
        grantor: Grantor.withScopes(TokenScopes.named(scopes)),
        by: BY,
      });

    expect(() => defining(['configure', 'trusts'])).toThrow(
      TokenTrustBeyondGrantorError,
    );
    expect(defining(['configure', 'secrets', 'trusts']).scopes.toString()).toBe(
      'configure, secrets',
    );
    expect(() =>
      stored().update(
        terms({ scopes: ['plan'] }),
        Grantor.withScopes(TokenScopes.named(['configure', 'trusts'])),
        BY,
      ),
    ).toThrow(TokenTrustBeyondGrantorError);
    expect(
      stored()
        .update(
          terms({ scopes: ['plan'] }),
          Grantor.withScopes(
            TokenScopes.named(['configure', 'secrets', 'trusts']),
          ),
          BY,
        )
        .scopes.toString(),
    ).toBe('plan');
  });

  it('is deleted only by a grantor with every scope it grants', () => {
    expect(() =>
      stored().delete(
        Grantor.withScopes(TokenScopes.named(['plan', 'trusts'])),
        BY,
      ),
    ).toThrow(TokenTrustBeyondGrantorError);
    expect(
      stored().delete(
        Grantor.withScopes(
          TokenScopes.named(['configure', 'secrets', 'trusts']),
        ),
        BY,
      ).isDeleted,
    ).toBe(true);
  });

  it('keeps its key for life', () => {
    expect(() =>
      stored().update(terms({ key: 'github-release' }), Grantor.unlimited, BY),
    ).toThrow(ImmutableFieldError);
  });

  it('is written over only at the version it was read at', () => {
    expect(() => stored(2).assertVersion(1)).toThrow(
      TokenTrustVersionConflictError,
    );
  });

  it('matches nothing, and cannot change, once deleted', () => {
    const deleted = stored().delete(Grantor.unlimited, BY);

    expect(deleted.matches(workload())).toBe(false);
    expect(deleted.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-token-trust.deleted',
    ]);
    expect(() => deleted.delete(Grantor.unlimited, BY)).toThrow(
      InconsistentStateError,
    );
  });
});

describe('an issued WorkspaceToken', () => {
  it('expires once its time ends, saying so without changing configuration', () => {
    const token = issuedToken();
    token.pullEvents();

    const expired = token.expire(new Date('2026-09-25T10:16:00.000Z'));

    expect(expired.isRevoked).toBe(true);
    expect(expired.pullEvents()).toEqual([
      new WorkspaceTokenExpired(token.id, token.workspaceId, token.name),
    ]);
  });

  it('does not expire while it is still valid', () => {
    expect(() => issuedToken().expire(NOW)).toThrow(InconsistentStateError);
  });

  it('is never described anew, since it is not configuration', () => {
    const token = issuedToken();

    expect(() =>
      token.update(
        {
          name: token.name,
          description: token.description,
          scopes: token.scopes,
          expiresAt: token.expiresAt,
        },
        BY,
      ),
    ).toThrow(ImmutableFieldError);
  });

  it('is revoked like any other token, saying so', () => {
    const token = issuedToken();
    token.pullEvents();

    const revoked = token.revoke(BY);

    expect(revoked.isRevoked).toBe(true);
    expect(revoked.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-token.revoked',
    ]);
  });
});

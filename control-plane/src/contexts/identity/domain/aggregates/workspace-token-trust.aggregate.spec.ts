import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenLapsed } from '@identity/domain/events/workspace-token-lapsed.event';
import { MintedTokenFixedError } from '@identity/domain/exceptions/minted-token-fixed.error';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import { TokenTrustKeyFixedError } from '@identity/domain/exceptions/token-trust-key-fixed.error';
import { TokenTrustVersionConflictError } from '@identity/domain/exceptions/token-trust-version-conflict.error';
import { WorkloadNotAdmittedError } from '@identity/domain/exceptions/workload-not-admitted.error';
import { Grantor } from '@identity/domain/value-objects/grantor.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
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

const kept = (version = 2) =>
  WorkspaceTokenTrust.rehydrate({
    ...terms(),
    id: ID,
    workspaceId: WORKSPACE,
    definedBy: ADMIN,
    version,
  });

const workload = (subject = MAIN): WorkloadClaims => ({
  issuer: ISSUER,
  subject,
  audiences: ['spotlight'],
  named: {},
});

const minted = (trust = kept(), claims = workload()) =>
  trust.mintFor(claims, {
    id: WorkspaceTokenId.of('token_9'),
    hash: TokenHash.of('b'.repeat(64)),
    now: NOW,
    client: Client.named('terraform-provider/0.2.0'),
  });

describe('WorkspaceTokenTrust', () => {
  it('says it was defined, by whom, and remembers who defined it', () => {
    const defined = WorkspaceTokenTrust.define({
      ...terms(),
      id: ID,
      workspaceId: WORKSPACE,
      definedBy: ADMIN,
      grantor: Grantor.unlimited,
      by: BY,
    });

    expect(defined.definedBy).toEqual(ADMIN);
    expect(defined.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-token-trust.defined',
    ]);
  });

  it('mints a token that acts for whoever defined it, through the trust, until its lifetime runs out', () => {
    const token = minted();

    expect(token.mintedThrough).toEqual(ID);
    expect(token.name.value).toBe('github-main');
    expect(token.scopes.toString()).toBe('configure, secrets');
    expect(token.expiresAt).toEqual(new Date('2026-09-25T10:15:00.000Z'));
    expect(token.principal).toMatchObject({ userId: ADMIN, mintedThrough: ID });
    expect(token.admitsAt(new Date('2026-09-25T10:14:59.000Z'))).toBe(true);
    expect(token.admitsAt(new Date('2026-09-25T10:15:00.000Z'))).toBe(false);
  });

  it('records the exchange as the minted token itself, naming the trust and the workload', () => {
    const [issued] = minted().pullEvents();

    expect(issued).toBeInstanceOf(WorkspaceTokenIssued);
    expect((issued as WorkspaceTokenIssued).change.by.actor).toMatchObject({
      principal: {
        tokenId: WorkspaceTokenId.of('token_9'),
        mintedThrough: ID,
      },
    });
    expect((issued as WorkspaceTokenIssued).change.recordedDetail).toEqual({
      trust: 'trust_1',
      subject: MAIN,
      scopes: ['configure', 'secrets'],
      expiresAt: '2026-09-25T10:15:00.000Z',
    });
  });

  it('mints nothing for a workload it does not admit', () => {
    expect(() =>
      minted(kept(), workload('repo:acme/platform:pull_request')),
    ).toThrow(WorkloadNotAdmittedError);
  });

  it('still grants a token only while it stands as it was when the token was minted', () => {
    const token = minted(kept(2));

    expect(token.mintedUnder).toBe(2);
    expect(kept(2).stillGrants(token)).toBe(true);
    expect(kept(3).stillGrants(token)).toBe(false);
    expect(kept(2).withdraw(Grantor.unlimited, BY).stillGrants(token)).toBe(
      false,
    );
  });

  it('changes nothing, and so cuts no token, when redefined as it already is', () => {
    const standing = kept();

    expect(standing.redefinedAs(terms(), Grantor.unlimited, BY)).toBe(standing);
    expect(standing.pullEvents()).toEqual([]);
    expect(
      kept()
        .redefinedAs(terms({ minutes: 5 }), Grantor.unlimited, BY)
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['workspace-token-trust.redefined']);
  });

  it('grants no scope beyond those of a token defining or redefining it', () => {
    const defining = (scopes: string[]) =>
      WorkspaceTokenTrust.define({
        ...terms(),
        id: ID,
        workspaceId: WORKSPACE,
        definedBy: ADMIN,
        grantor: Grantor.holding(TokenScopes.named(scopes)),
        by: BY,
      });

    expect(() => defining(['configure', 'trusts'])).toThrow(
      TokenTrustBeyondGrantorError,
    );
    expect(defining(['configure', 'secrets', 'trusts']).scopes.toString()).toBe(
      'configure, secrets',
    );
    expect(() =>
      kept().redefinedAs(
        terms({ scopes: ['plan'] }),
        Grantor.holding(TokenScopes.named(['configure', 'trusts'])),
        BY,
      ),
    ).toThrow(TokenTrustBeyondGrantorError);
    expect(
      kept()
        .redefinedAs(
          terms({ scopes: ['plan'] }),
          Grantor.holding(
            TokenScopes.named(['configure', 'secrets', 'trusts']),
          ),
          BY,
        )
        .scopes.toString(),
    ).toBe('plan');
  });

  it('is withdrawn only by a grantor holding every scope it grants', () => {
    expect(() =>
      kept().withdraw(
        Grantor.holding(TokenScopes.named(['plan', 'trusts'])),
        BY,
      ),
    ).toThrow(TokenTrustBeyondGrantorError);
    expect(
      kept().withdraw(
        Grantor.holding(TokenScopes.named(['configure', 'secrets', 'trusts'])),
        BY,
      ).isWithdrawn,
    ).toBe(true);
  });

  it('keeps its key for life', () => {
    expect(() =>
      kept().redefinedAs(
        terms({ key: 'github-release' }),
        Grantor.unlimited,
        BY,
      ),
    ).toThrow(TokenTrustKeyFixedError);
  });

  it('is written over only at the version it was read at', () => {
    expect(() => kept(2).assertVersion(1)).toThrow(
      TokenTrustVersionConflictError,
    );
  });

  it('admits nothing, and cannot change, once withdrawn', () => {
    const withdrawn = kept().withdraw(Grantor.unlimited, BY);

    expect(withdrawn.admits(workload())).toBe(false);
    expect(withdrawn.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-token-trust.withdrawn',
    ]);
    expect(() => withdrawn.withdraw(Grantor.unlimited, BY)).toThrow(
      InconsistentStateError,
    );
  });
});

describe('a minted WorkspaceToken', () => {
  it('lapses once expired, saying so without changing configuration', () => {
    const token = minted();
    token.pullEvents();

    const lapsed = token.lapsed(new Date('2026-09-25T10:16:00.000Z'));

    expect(lapsed.isRevoked).toBe(true);
    expect(lapsed.pullEvents()).toEqual([
      new WorkspaceTokenLapsed(token.id, token.workspaceId, token.name),
    ]);
  });

  it('does not lapse while it still admits its bearer', () => {
    expect(() => minted().lapsed(NOW)).toThrow(InconsistentStateError);
  });

  it('is never described anew, since it is not configuration', () => {
    const token = minted();

    expect(() =>
      token.redescribe(
        {
          name: token.name,
          description: token.description,
          scopes: token.scopes,
          expiresAt: token.expiresAt,
        },
        BY,
      ),
    ).toThrow(MintedTokenFixedError);
  });

  it('is revoked like any other token, saying so', () => {
    const token = minted();
    token.pullEvents();

    const revoked = token.revoke(BY);

    expect(revoked.isRevoked).toBe(true);
    expect(revoked.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-token.revoked',
    ]);
  });
});

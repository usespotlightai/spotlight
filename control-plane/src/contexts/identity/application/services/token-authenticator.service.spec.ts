import { TokenAuthenticator } from '@identity/application/services/token-authenticator.service';
import { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-25T10:00:00.000Z');
const MAIN = 'repo:acme/platform:ref:refs/heads/main';
const ISSUER = 'https://token.actions.githubusercontent.com';

const trustAt = (version: number) =>
  OidcTrust.rehydrate({
    id: OidcTrustId.of('trust_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: OidcTrustKey.of('github-main'),
    workload: WorkloadRule.of({
      issuer: ISSUER,
      audience: 'spotlight',
      subject: MAIN,
      claims: {},
    }),
    scopes: TokenScopes.named(['configure']),
    lifetime: TokenLifetime.ofMinutes(15),
    createdBy: UserId.of('admin_1'),
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    version,
  });

const ISSUED_BY_TRUST = trustAt(1).issueFor(
  { issuer: ISSUER, subject: MAIN, audiences: ['spotlight'], customClaims: {} },
  {
    id: WorkspaceTokenId.of('token_1'),
    hash: TokenHash.of('d'.repeat(64)),
    now: NOW,
    client: Client.named('web'),
  },
);

const authenticator = (
  token: WorkspaceToken | null,
  trust: OidcTrust | null,
  at = NOW,
) =>
  new TokenAuthenticator(
    {
      findByHash: vi.fn(async () => token),
    } as unknown as WorkspaceTokenRepository,
    {
      find: vi.fn(async () => trust),
    } as unknown as OidcTrustRepository,
    { hash: () => 'd'.repeat(64) } as unknown as TokenIssuer,
    { now: () => at, sleep: async () => {} },
  );

describe('TokenAuthenticator', () => {
  it('knows a token issued by a trust while the trust is the same as when it issued the token', async () => {
    expect(
      await authenticator(ISSUED_BY_TRUST, trustAt(1)).authenticate('bearer'),
    ).toMatchObject({
      issuedByTrustId: OidcTrustId.of('trust_1'),
    });
  });

  it('knows no token issued by a trust once the trust is gone or has changed', async () => {
    expect(
      await authenticator(ISSUED_BY_TRUST, null).authenticate('bearer'),
    ).toBeNull();
    expect(
      await authenticator(ISSUED_BY_TRUST, trustAt(2)).authenticate('bearer'),
    ).toBeNull();
  });

  it('knows no token once it has expired', async () => {
    expect(
      await authenticator(
        ISSUED_BY_TRUST,
        trustAt(1),
        new Date('2026-09-25T10:15:00.000Z'),
      ).authenticate('bearer'),
    ).toBeNull();
  });

  it('knows no bearer it never issued', async () => {
    expect(await authenticator(null, null).authenticate('bearer')).toBeNull();
  });
});

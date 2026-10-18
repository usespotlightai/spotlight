import { ExchangeWorkloadTokenCommand } from '@identity/application/commands/exchange-workload-token.command';
import { ExchangeWorkloadTokenHandler } from '@identity/application/commands/handlers/exchange-workload-token.handler';
import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { WorkloadTokensPort } from '@shared-kernel/application/ports/workload-tokens.port';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ISSUER = 'https://token.actions.githubusercontent.com';
const MAIN = 'repo:acme/platform:ref:refs/heads/main';
const NOW = new Date('2026-09-25T10:00:00.000Z');

const SPEC = {
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
  createdBy: UserId.of('admin_1'),
};

const TRUST = WorkspaceTokenTrust.rehydrate({ ...SPEC, version: 0 });

const CLAIMS: WorkloadClaims = {
  issuer: ISSUER,
  subject: MAIN,
  audiences: ['spotlight'],
  customClaims: {},
};

const exchanging = (
  over: {
    trust?: WorkspaceTokenTrust | null;
    claims?: WorkloadClaims | null;
    locked?: WorkspaceTokenTrust | null;
    adding?: Error;
  } = {},
) => {
  const add = vi.fn(async () => {
    if (over.adding) {
      throw over.adding;
    }
  });
  const verify = vi.fn(async () =>
    over.claims === undefined ? CLAIMS : over.claims,
  );
  const handler = new ExchangeWorkloadTokenHandler(
    {
      find: vi.fn(async () => (over.trust === undefined ? TRUST : over.trust)),
      findLocked: vi.fn(async () =>
        over.locked === undefined ? TRUST : over.locked,
      ),
    } as unknown as WorkspaceTokenTrustRepository,
    { add } as unknown as WorkspaceTokenRepository,
    { verify } satisfies WorkloadTokensPort,
    { generate: () => 'token_1' },
    {
      issue: () => ({ token: 'issued-token', hash: 'c'.repeat(64) }),
    } as unknown as TokenIssuer,
    { now: () => NOW, sleep: async () => {} },
    { inTransaction: (work) => work() },
  );

  return {
    add,
    verify,
    exchange: (token = 'oidc-token') =>
      handler.execute(
        new ExchangeWorkloadTokenCommand('trust_1', token, Client.named('web')),
      ),
  };
};

describe('ExchangeWorkloadTokenHandler', () => {
  it('verifies the workload against the trust’s issuer and audience, and issues a token for it that expires as the token itself does', async () => {
    const { exchange, verify, add } = exchanging();

    expect(await exchange()).toEqual({
      token: 'issued-token',
      tokenId: 'token_1',
      workspaceId: 'ws_1',
      scopes: ['configure'],
      expiresAt: '2026-09-25T10:15:00.000Z',
    });
    expect(verify).toHaveBeenCalledWith('oidc-token', {
      issuer: ISSUER,
      audience: 'spotlight',
    });
    expect(add).toHaveBeenCalledOnce();
  });

  it('issues nothing through a trust that does not exist', async () => {
    const { exchange, verify } = exchanging({ trust: null });

    expect(await exchange()).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it('issues nothing for a token its issuer did not sign', async () => {
    const { exchange, add } = exchanging({ claims: null });

    expect(await exchange()).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('issues nothing for a workload the trust does not match', async () => {
    const { exchange, add } = exchanging({
      claims: { ...CLAIMS, subject: 'repo:acme/platform:pull_request' },
    });

    expect(await exchange()).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('issues nothing through a trust deleted, or changed to deny the workload, while it was verified', async () => {
    expect(await exchanging({ locked: null }).exchange()).toBeNull();
    expect(
      await exchanging({
        locked: WorkspaceTokenTrust.rehydrate({
          ...SPEC,
          workload: WorkloadRule.of({
            issuer: ISSUER,
            audience: 'spotlight',
            subject: 'repo:acme/platform:pull_request',
            claims: {},
          }),
          version: 1,
        }),
      }).exchange(),
    ).toBeNull();
  });

  it('issues nothing into a workspace deleted while it issued', async () => {
    expect(
      await exchanging({
        adding: new NoSuchWorkspaceError('ws_1'),
      }).exchange(),
    ).toBeNull();
  });

  it('issues nothing for an empty token', async () => {
    const { exchange, verify } = exchanging();

    expect(await exchange('  ')).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });
});

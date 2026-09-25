import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenRedescribed } from '@identity/domain/events/workspace-token-redescribed.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { WorkspaceTokenMovedOnError } from '@identity/domain/exceptions/workspace-token-moved-on.error';
import { WorkspaceTokenTermsFixedError } from '@identity/domain/exceptions/workspace-token-terms-fixed.error';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-24T09:00:00.000Z');
const LATER = new Date('2026-12-31T00:00:00.000Z');
const ID = WorkspaceTokenId.of('token_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const BY = attributedIn('ws_1');
const CI = { resource: 'workspace-token' as const, id: 'token_1', key: 'ci' };

const terms = (
  over: Partial<{
    name: string;
    scopes: readonly string[];
    expiresAt: Date | null;
    description: string;
  }> = {},
) => ({
  name: TokenName.of(over.name ?? 'ci'),
  scopes: TokenScopes.named(over.scopes ?? ['plan']),
  expiresAt: over.expiresAt === undefined ? LATER : over.expiresAt,
  description: TokenDescription.of(over.description ?? 'Plans on every PR'),
});

const issued = (over: Parameters<typeof terms>[0] = {}) =>
  WorkspaceToken.issue({
    ...terms(over),
    id: ID,
    workspaceId: WORKSPACE,
    hash: TokenHash.of('a'.repeat(64)),
    issuedBy: UserId.of('user_1'),
    now: NOW,
    by: BY,
  });

const kept = (version = 2) =>
  WorkspaceToken.rehydrate({
    ...terms(),
    id: ID,
    workspaceId: WORKSPACE,
    hash: TokenHash.of('a'.repeat(64)),
    issuedBy: UserId.of('user_1'),
    issuedAt: NOW,
    mintedThrough: null,
    mintedUnder: null,
    version,
  });

describe('WorkspaceToken', () => {
  it('is issued within a workspace, and says who issued it', () => {
    expect(issued().pullEvents()).toEqual([
      new WorkspaceTokenIssued(
        ID,
        WORKSPACE,
        TokenName.of('ci'),
        ConfigurationChange.created(CI, BY),
      ),
    ]);
  });

  it('acts as a principal of its own workspace, within its scopes, for whoever issued it', () => {
    expect(issued({ scopes: ['configure', 'secrets'] }).principal).toEqual(
      TokenPrincipal.of({
        tokenId: ID,
        workspaceId: WORKSPACE,
        scopes: TokenScopes.named(['configure', 'secrets']),
        issuedBy: UserId.of('user_1'),
      }),
    );
  });

  it('will not be issued already expired', () => {
    expect(() => issued({ expiresAt: NOW })).toThrow(
      InvalidWorkspaceTokenError,
    );
  });

  it('admits until it expires, and for ever when it never does', () => {
    expect(kept().admitsAt(NOW)).toBe(true);
    expect(kept().admitsAt(LATER)).toBe(false);
    expect(issued({ expiresAt: null }).admitsAt(new Date('2999-01-01'))).toBe(
      true,
    );
  });

  it('takes a new description, and says so', () => {
    const redescribed = kept().redescribed(
      terms({ description: 'Applies from main' }),
      BY,
    );

    expect(redescribed.description.value).toBe('Applies from main');
    expect(redescribed.pullEvents()).toEqual([
      new WorkspaceTokenRedescribed(
        ID,
        WORKSPACE,
        TokenName.of('ci'),
        ConfigurationChange.updated(CI, BY),
      ),
    ]);
  });

  it.each([
    ['name', terms({ name: 'deploy' })],
    ['scopes', terms({ scopes: ['plan', 'secrets'] })],
    ['expiresAt', terms({ expiresAt: null })],
  ])('keeps its %s as issued', (field, changed) => {
    expect(() => kept().redescribed(changed, BY)).toThrow(
      expect.objectContaining({ field }),
    );
    expect(() => kept().redescribed(changed, BY)).toThrow(
      WorkspaceTokenTermsFixedError,
    );
  });

  it('refuses a change made against another version', () => {
    expect(() => kept(2).expecting(1)).toThrow(WorkspaceTokenMovedOnError);
  });

  it('admits nobody once revoked, and cannot change after', () => {
    const revoked = kept().revoked(BY);

    expect(revoked.admitsAt(NOW)).toBe(false);
    expect(revoked.pullEvents()).toEqual([
      new WorkspaceTokenRevoked(
        ID,
        WORKSPACE,
        TokenName.of('ci'),
        ConfigurationChange.deleted(CI, BY),
      ),
    ]);
    expect(() => revoked.revoked(BY)).toThrow(InconsistentStateError);
  });
});

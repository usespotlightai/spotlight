import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenRedescribed } from '@identity/domain/events/workspace-token-redescribed.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { WorkspaceTokenTermsFixedError } from '@identity/domain/exceptions/workspace-token-terms-fixed.error';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
    mintedForRun: null,
    mintedForAttempt: null,
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

  it('names its expiry only when it has one', () => {
    expect(kept().expiry()).toEqual(LATER);
    expect(() => issued({ expiresAt: null }).expiry()).toThrow(
      InconsistentStateError,
    );
  });

  it('takes a new description, and says so', () => {
    const redescribed = kept().redescribe(
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
    expect(() => kept().redescribe(changed, BY)).toThrow(
      expect.objectContaining({ field }),
    );
    expect(() => kept().redescribe(changed, BY)).toThrow(
      WorkspaceTokenTermsFixedError,
    );
  });

  it('refuses a change made against another version', () => {
    expect(() => kept(2).assertVersion(1)).toThrow(
      WorkspaceTokenVersionConflictError,
    );
  });

  it('admits nobody once revoked, and cannot change after', () => {
    const revoked = kept().revoke(BY);

    expect(revoked.admitsAt(NOW)).toBe(false);
    expect(revoked.pullEvents()).toEqual([
      new WorkspaceTokenRevoked(
        ID,
        WORKSPACE,
        TokenName.of('ci'),
        ConfigurationChange.deleted(CI, BY),
      ),
    ]);
    expect(() => revoked.revoke(BY)).toThrow(InconsistentStateError);
  });

  describe('minted for a run', () => {
    const HOUR_LATER = new Date(NOW.getTime() + 60 * 60 * 1_000);

    const forRun = (expiresAt = HOUR_LATER, scopes = ['plan']) =>
      WorkspaceToken.forRun({
        id: ID,
        workspaceId: WORKSPACE,
        name: TokenName.of('run-token-1'),
        scopes: TokenScopes.named(scopes),
        hash: TokenHash.of('a'.repeat(64)),
        issuedBy: UserId.of('user_1'),
        runId: RunId.of('run_1'),
        attempt: 1,
        expiresAt,
        now: NOW,
      });

    it('belongs to the run, and counts as minted', () => {
      const token = forRun();

      expect(token.mintedForRun?.value).toBe('run_1');
      expect(token.mintedThrough).toBeNull();
      expect(token.isMinted).toBe(true);
      expect(token.admitsAt(NOW)).toBe(true);
    });

    it('records Spotlight issuing it, with the run and when it ends', () => {
      const [issued] = forRun().pullEvents() as WorkspaceTokenIssued[];

      expect(issued).toBeInstanceOf(WorkspaceTokenIssued);
      expect(issued?.change.detail?.recorded()).toEqual({
        run: 'run_1',
        attempt: 1,
        scopes: ['plan'],
        expiresAt: HOUR_LATER.toISOString(),
      });
    });

    it('must end after it is minted', () => {
      expect(() => forRun(NOW)).toThrow(InvalidWorkspaceTokenError);
    });

    it('lasts at most an hour', () => {
      expect(() =>
        forRun(new Date(NOW.getTime() + 60 * 60 * 1_000 + 1)),
      ).toThrow(InvalidWorkspaceTokenError);
    });

    it('may plan, never configure or read secrets', () => {
      expect(() => forRun(HOUR_LATER, ['configure'])).toThrow(
        InvalidWorkspaceTokenError,
      );
      expect(() => forRun(HOUR_LATER, ['plan', 'secrets'])).toThrow(
        InvalidWorkspaceTokenError,
      );
      expect(forRun(HOUR_LATER, ['read']).isMinted).toBe(true);
    });

    it('lapses once it ends', () => {
      const token = forRun();

      expect(token.admitsAt(new Date(HOUR_LATER.getTime() + 1))).toBe(false);
    });
  });
});

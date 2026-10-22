import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { WorkspaceTokenUpdated } from '@identity/domain/events/workspace-token-updated.event';
import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
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
const BY = changeActorIn('ws_1');
const CI = { resource: 'workspace-token' as const, id: 'token_1', key: 'ci' };

const spec = (
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

const issued = (over: Parameters<typeof spec>[0] = {}) =>
  WorkspaceToken.issue({
    ...spec(over),
    id: ID,
    workspaceId: WORKSPACE,
    hash: TokenHash.of('a'.repeat(64)),
    issuedBy: UserId.of('user_1'),
    now: NOW,
    by: BY,
  });

const stored = (version = 2) =>
  WorkspaceToken.rehydrate({
    ...spec(),
    id: ID,
    workspaceId: WORKSPACE,
    hash: TokenHash.of('a'.repeat(64)),
    issuedBy: UserId.of('user_1'),
    issuedAt: NOW,
    issuedByTrustId: null,
    trustVersion: null,
    runId: null,
    runAttempt: null,
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
        null,
        NOW,
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

  it('is active until it expires, and for ever when it never does', () => {
    expect(stored().isActiveAt(NOW)).toBe(true);
    expect(stored().isActiveAt(LATER)).toBe(false);
    expect(issued({ expiresAt: null }).isActiveAt(new Date('2999-01-01'))).toBe(
      true,
    );
  });

  it('names its expiry only when it has one', () => {
    expect(stored().expiry()).toEqual(LATER);
    expect(() => issued({ expiresAt: null }).expiry()).toThrow(
      InconsistentStateError,
    );
  });

  it('takes a new description, and says so', () => {
    const updated = stored().update(
      spec({ description: 'Applies from main' }),
      BY,
    );

    expect(updated.description.value).toBe('Applies from main');
    expect(updated.pullEvents()).toEqual([
      new WorkspaceTokenUpdated(
        ID,
        WORKSPACE,
        TokenName.of('ci'),
        ConfigurationChange.updated(CI, BY),
      ),
    ]);
  });

  it.each([
    ['name', spec({ name: 'deploy' })],
    ['scopes', spec({ scopes: ['plan', 'secrets'] })],
    ['expiresAt', spec({ expiresAt: null })],
  ])('keeps its %s as issued', (field, changed) => {
    expect(() => stored().update(changed, BY)).toThrow(
      expect.objectContaining({ field }),
    );
    expect(() => stored().update(changed, BY)).toThrow(ImmutableFieldError);
  });

  it('rejects a change made against another version', () => {
    expect(() => stored(2).assertVersion(1)).toThrow(
      WorkspaceTokenVersionConflictError,
    );
  });

  it('is not active once revoked, and cannot change after', () => {
    const revoked = stored().revoke(BY);

    expect(revoked.isActiveAt(NOW)).toBe(false);
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

  describe('issued for a run', () => {
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

    it('belongs to the run, and counts as issued by Spotlight', () => {
      const token = forRun();

      expect(token.runId?.value).toBe('run_1');
      expect(token.issuedByTrustId).toBeNull();
      expect(token.isIssuedBySpotlight).toBe(true);
      expect(token.isActiveAt(NOW)).toBe(true);
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

    it('must end after it is issued', () => {
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
      expect(forRun(HOUR_LATER, ['read']).isIssuedBySpotlight).toBe(true);
    });

    it('expires once it ends', () => {
      const token = forRun();

      expect(token.isActiveAt(new Date(HOUR_LATER.getTime() + 1))).toBe(false);
    });
  });
});

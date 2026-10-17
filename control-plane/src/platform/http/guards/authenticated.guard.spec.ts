import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import { ALLOW_WORKSPACE_TOKENS } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import { REQUEST_PRINCIPAL } from '@platform/http/decorators/current-principal.decorator';
import { AuthenticatedGuard } from '@platform/http/guards/authenticated.guard';
import type { SessionReaderPort } from '@shared-kernel/application/ports/session.port';
import type { WorkspaceTokenIdentityPort } from '@shared-kernel/application/ports/workspace-token-identity.port';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = { id: 'u1', email: 'dev@example.com', name: 'Dev' };

const TOKEN = TokenPrincipal.of({
  tokenId: WorkspaceTokenId.of('token_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  scopes: TokenScopes.named(['plan']),
  issuedBy: UserId.of('u1'),
});

function setup(
  options: {
    anonymous?: boolean;
    allowsTokens?: boolean;
    session?: boolean;
    bearer?: string;
    known?: boolean;
  } = {},
) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (marker) =>
      (marker === ALLOW_ANONYMOUS && options.anonymous) ||
      (marker === ALLOW_WORKSPACE_TOKENS && options.allowsTokens) ||
      false,
  );

  const read = vi.fn().mockResolvedValue(options.session ? USER : null);
  const sessions = { read } as unknown as SessionReaderPort;
  const identify = vi.fn().mockResolvedValue(options.known ? TOKEN : null);
  const tokens = { identify } satisfies WorkspaceTokenIdentityPort;

  const request: Record<string | symbol, unknown> = {
    headers: {
      cookie: 'x',
      ...(options.bearer ? { authorization: `Bearer ${options.bearer}` } : {}),
    },
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return {
    guard: new AuthenticatedGuard(reflector, sessions, tokens),
    context,
    read,
    identify,
    request,
  };
}

describe('AuthenticatedGuard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('denies a request that carries no session', async () => {
    const { guard, context } = setup({ session: false });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a request with a session, as the person signed in', async () => {
    const { guard, context, request } = setup({ session: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[REQUEST_PRINCIPAL]).toEqual(
      PersonPrincipal.of(UserId.of('u1')),
    );
  });

  it('accepts a route marked anonymous without reading the session', async () => {
    const { guard, context, read } = setup({ anonymous: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it('accepts a workspace token where the route allows tokens, as that token', async () => {
    const { guard, context, request, identify, read } = setup({
      allowsTokens: true,
      bearer: 'abc',
      known: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(identify).toHaveBeenCalledWith('abc');
    expect(read).not.toHaveBeenCalled();
    expect(request[REQUEST_PRINCIPAL]).toBe(TOKEN);
  });

  it('does not accept a token it does not know, rather than falling back to the session', async () => {
    const { guard, context } = setup({
      allowsTokens: true,
      bearer: 'revoked',
      known: false,
      session: true,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('never takes a workspace token on a route that allows only people', async () => {
    const { guard, context, identify } = setup({
      bearer: 'abc',
      known: true,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(identify).not.toHaveBeenCalled();
  });
});

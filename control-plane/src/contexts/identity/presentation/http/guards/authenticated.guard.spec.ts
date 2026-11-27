import type { SessionReaderPort } from '@identity/application/ports/session-reader.port';
import type { WorkspaceTokenIdentityPort } from '@identity/application/ports/workspace-token-identity.port';
import { IssuedTokenGrant } from '@identity/domain/value-objects/issued-token-grant.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import { AuthenticatedGuard } from '@identity/presentation/http/guards/authenticated.guard';
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ONLY } from '@platform/http/decorators/admin-only.decorator';
import {
  ALLOW_ANONYMOUS,
  READS_SESSION_IF_ANY,
} from '@platform/http/decorators/allow-anonymous.decorator';
import { ALLOW_WORKSPACE_TOKENS } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import { REQUEST_PRINCIPAL } from '@platform/http/decorators/current-principal.decorator';
import { REQUEST_USER } from '@platform/http/decorators/current-user.decorator';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = { id: 'u1', email: 'dev@example.com', name: 'Dev' };

const LOGIN = 'login-session';

const TOKEN = IssuedTokenGrant.principal({
  tokenId: WorkspaceTokenId.of('token_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  scopes: TokenScopes.named(['plan']),
  issuedBy: UserId.of('u1'),
});

function setup(
  options: {
    anonymous?: boolean;
    adminOnly?: boolean;
    readsSession?: boolean;
    allowsTokens?: boolean;
    session?: boolean;
    bearer?: string;
    known?: boolean;
    login?: boolean;
  } = {},
) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (marker) =>
      (marker === ALLOW_ANONYMOUS && options.anonymous === true) ||
      (marker === ADMIN_ONLY && options.adminOnly === true) ||
      (marker === READS_SESSION_IF_ANY && options.readsSession === true) ||
      (marker === ALLOW_WORKSPACE_TOKENS && options.allowsTokens === true) ||
      false,
  );

  const read = vi.fn().mockResolvedValue(options.session ? USER : null);
  const readBearer = vi.fn(async (token: string) =>
    options.login && token === LOGIN ? USER : null,
  );
  const sessions = { read, readBearer } satisfies SessionReaderPort;
  const authenticate = vi.fn().mockResolvedValue(options.known ? TOKEN : null);
  const tokens = {
    authenticate,
  } satisfies WorkspaceTokenIdentityPort;

  const headers: Record<string, string> = {
    cookie: 'x',
    ...(nonEmpty(options.bearer)
      ? { authorization: `Bearer ${options.bearer}` }
      : {}),
  };
  const request: Record<string | symbol, unknown> = { headers };
  const context = partial<ExecutionContext>({
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () =>
      partial<ReturnType<ExecutionContext['switchToHttp']>>({
        getRequest: vi.fn().mockReturnValue(request),
      }),
  });

  return {
    guard: new AuthenticatedGuard(reflector, sessions, tokens),
    context,
    read,
    readBearer,
    authenticate,
    request,
    headers,
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

  it('leaves an admin route to the admin guard, and never reads a session or a workspace token for it', async () => {
    const { guard, context, request, read, readBearer, authenticate } = setup({
      adminOnly: true,
      bearer: LOGIN,
      login: true,
      session: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(read).not.toHaveBeenCalled();
    expect(readBearer).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    expect(request[REQUEST_PRINCIPAL]).toBeUndefined();
  });

  it('accepts an anonymous route that reads the session, as the person signed in or as nobody', async () => {
    const signedIn = setup({
      anonymous: true,
      readsSession: true,
      session: true,
    });
    const nobody = setup({ anonymous: true, readsSession: true });

    await expect(signedIn.guard.canActivate(signedIn.context)).resolves.toBe(
      true,
    );
    await expect(nobody.guard.canActivate(nobody.context)).resolves.toBe(true);
    expect(signedIn.request[REQUEST_USER]).toEqual(USER);
    expect(nobody.request[REQUEST_USER]).toBeUndefined();
  });

  it('accepts a workspace token where the route allows tokens, as that token', async () => {
    const { guard, context, request, authenticate, read } = setup({
      allowsTokens: true,
      bearer: 'abc',
      known: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith('abc');
    expect(read).not.toHaveBeenCalled();
    expect(request[REQUEST_PRINCIPAL]).toBe(TOKEN);
  });

  it('does not accept a token it does not know, rather than falling back to the cookie session', async () => {
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
    const { guard, context, authenticate } = setup({
      bearer: 'abc',
      known: true,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('accepts the login of a person sent as a bearer where the route allows tokens, as that person', async () => {
    const { guard, context, request } = setup({
      allowsTokens: true,
      bearer: LOGIN,
      login: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[REQUEST_PRINCIPAL]).toEqual(
      PersonPrincipal.of(UserId.of('u1')),
    );
  });

  it('accepts the login of a person sent as a bearer on a route that allows only people', async () => {
    const { guard, context, request, authenticate } = setup({
      bearer: LOGIN,
      login: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
    expect(request[REQUEST_PRINCIPAL]).toEqual(
      PersonPrincipal.of(UserId.of('u1')),
    );
  });

  it('reads the login from the bearer alone, never from the cookie beside it', async () => {
    const { guard, context, read, readBearer } = setup({
      bearer: 'ended-login',
      session: true,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(readBearer).toHaveBeenCalledWith('ended-login');
    expect(read).not.toHaveBeenCalled();
  });

  it('takes the bearer scheme in any case', async () => {
    const { guard, context, headers, readBearer } = setup({
      login: true,
    });
    headers.authorization = `bearer ${LOGIN}`;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(readBearer).toHaveBeenCalledWith(LOGIN);
  });

  it('turns away another authorization scheme, rather than falling back to the cookie session', async () => {
    const { guard, context, headers, read } = setup({ session: true });
    headers.authorization = 'Basic abc';

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(read).not.toHaveBeenCalled();
  });
});

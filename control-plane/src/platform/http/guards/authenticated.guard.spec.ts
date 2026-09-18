import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedGuard } from '@platform/http/guards/authenticated.guard';
import type { SessionReaderPort } from '@shared-kernel/application/ports/session.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = { id: 'u1', email: 'dev@example.com', name: 'Dev' };

function setup(options: { anonymous?: boolean; session?: boolean } = {}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
    options.anonymous ?? false,
  );

  const read = vi.fn().mockResolvedValue(options.session ? USER : null);
  const sessions = { read } as unknown as SessionReaderPort;

  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ headers: { cookie: 'x' } }) }),
  } as unknown as ExecutionContext;

  return { guard: new AuthenticatedGuard(reflector, sessions), context, read };
}

describe('AuthenticatedGuard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('denies a request that carries no session', async () => {
    const { guard, context } = setup({ session: false });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('admits a request with a session', async () => {
    const { guard, context } = setup({ session: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('admits a route marked anonymous without reading the session', async () => {
    const { guard, context, read } = setup({ anonymous: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(read).not.toHaveBeenCalled();
  });
});

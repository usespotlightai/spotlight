import {
  type ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import type { Env } from '@platform/config/env.schema';
import { ADMIN_ONLY } from '@platform/http/decorators/admin-only.decorator';
import { AdminGuard } from '@platform/http/guards/admin.guard';
import { RandomTokenIssuer } from '@platform/tokens/random-token-issuer.service';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const ADMIN_TOKEN = 'admin-token-0123456789abcdefghijklmnop';

function setup(options: {
  configured?: string;
  adminOnly?: boolean;
  authorization?: string;
}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (marker) => marker === ADMIN_ONLY && (options.adminOnly ?? true),
  );
  const env = partial<Env>({ SPOTLIGHT_ADMIN_TOKEN: options.configured });
  const request = {
    headers: nonEmpty(options.authorization)
      ? { authorization: options.authorization }
      : {},
  };
  const context: ExecutionContext = new ExecutionContextHost([request]);

  return {
    guard: new AdminGuard(reflector, env, new RandomTokenIssuer()),
    context,
  };
}

describe('AdminGuard', () => {
  it('lets every route that is not an admin route through', () => {
    const { guard, context } = setup({ adminOnly: false });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('answers 404 on an admin route when no admin token is set', () => {
    const { guard, context } = setup({
      authorization: `Bearer ${ADMIN_TOKEN}`,
    });

    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });

  it('accepts the admin token as a bearer', () => {
    const { guard, context } = setup({
      configured: ADMIN_TOKEN,
      authorization: `Bearer ${ADMIN_TOKEN}`,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it.each([
    ['no Authorization header', undefined],
    ['another token', 'Bearer workspace-token-0123456789abcdefghijk'],
    ['the admin token in another scheme', `Basic ${ADMIN_TOKEN}`],
    ['a token that only starts like the admin token', `Bearer ${ADMIN_TOKEN}x`],
  ])('refuses %s', (_, authorization) => {
    const { guard, context } = setup({
      configured: ADMIN_TOKEN,
      authorization,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});

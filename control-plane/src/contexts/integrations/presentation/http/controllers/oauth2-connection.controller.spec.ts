import type { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import type { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import {
  FAILED_REDIRECT,
  OAuth2ConnectionController,
  type Redirectable,
} from '@integrations/presentation/http/controllers/oauth2-connection.controller';
import {
  OAUTH2_NONCE_COOKIE,
  OAuth2NonceCookie,
} from '@integrations/presentation/http/oauth2-nonce-cookie';
import type { CommandBus } from '@nestjs/cqrs';
import type {
  AuthenticatedUser,
  SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';
import { describe, expect, it, vi } from 'vitest';

const ADMIN: AuthenticatedUser = {
  id: 'user_1',
  email: 'admin@example.com',
  name: 'Admin',
};

const EXPIRES = new Date('2026-09-07T10:10:00.000Z');

const answering = () => {
  const redirect = vi.fn();
  const cookie = vi.fn();
  const clearCookie = vi.fn();

  return {
    response: { redirect, cookie, clearCookie } as Redirectable,
    redirect,
    cookie,
    clearCookie,
  };
};

const controlling = (viewer: AuthenticatedUser | null = ADMIN) => {
  const execute = vi.fn(
    async (
      command: BeginOAuth2ConnectionCommand | FinishOAuth2ConnectionCommand,
    ) =>
      'state' in command
        ? 'https://app.example/landing'
        : { url: 'https://slack.com/oauth', nonce: 'n-1', expiresAt: EXPIRES },
  );

  return {
    controller: new OAuth2ConnectionController(
      { execute } as unknown as CommandBus,
      { read: async () => viewer } as SessionReaderPort,
      new OAuth2NonceCookie(true),
    ),
    execute,
  };
};

const withCookie = (value: string) => ({
  headers: { cookie: `other=1; ${OAUTH2_NONCE_COOKIE}=${value}` },
});

describe('OAuth2ConnectionController', () => {
  it('sets the nonce in a cookie only the callback can read', async () => {
    const { controller } = controlling();
    const { response, cookie } = answering();

    const started = await controller.connect(
      'team_1',
      'slack',
      ADMIN,
      response,
    );

    expect(started.url).toBe('https://slack.com/oauth');
    expect(cookie).toHaveBeenCalledWith(OAUTH2_NONCE_COOKIE, 'n-1', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/integrations/oauth/callback',
      expires: EXPIRES,
    });
  });

  it('finishes with the cookie nonce and the signed-in person, clearing the cookie', async () => {
    const { controller, execute } = controlling();
    const { response, redirect, clearCookie } = answering();

    await controller.callback('s', 'c', withCookie('n-1'), response);

    const finish = execute.mock.calls[0]?.[0] as FinishOAuth2ConnectionCommand;
    expect(finish.nonce).toBe('n-1');
    expect(finish.viewerId).toBe('user_1');
    expect(clearCookie).toHaveBeenCalledWith(
      OAUTH2_NONCE_COOKIE,
      expect.objectContaining({ path: '/api/integrations/oauth/callback' }),
    );
    expect(redirect).toHaveBeenCalledWith('https://app.example/landing');
  });

  it('rejects a browser that brought no nonce cookie', async () => {
    const { controller, execute } = controlling();
    const { response, redirect } = answering();

    await controller.callback('s', 'c', { headers: {} }, response);

    expect(execute).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(FAILED_REDIRECT);
  });

  it('rejects a browser with no session', async () => {
    const { controller, execute } = controlling(null);
    const { response, redirect } = answering();

    await controller.callback('s', 'c', withCookie('n-1'), response);

    expect(execute).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(FAILED_REDIRECT);
  });

  it('connects the team unless requested to connect the caller', async () => {
    const { controller, execute } = controlling();

    await controller.connect('team_1', 'slack', ADMIN, answering().response);

    const begin = execute.mock.calls[0]?.[0] as BeginOAuth2ConnectionCommand;
    expect(begin.holder).toBe('team');
    expect(begin.back).toBeNull();
  });

  it('connects the caller’s own account, carrying where to land', async () => {
    const { controller, execute } = controlling();

    await controller.connect('team_1', 'linear', ADMIN, answering().response, {
      for: 'me',
      back: '/w/acme/inbox/task_1',
    });

    const begin = execute.mock.calls[0]?.[0] as BeginOAuth2ConnectionCommand;
    expect(begin.holder).toBe('person');
    expect(begin.back).toBe('/w/acme/inbox/task_1');
  });

  it('denies a connection for anyone but the team or the caller', async () => {
    const { controller, execute } = controlling();

    await expect(
      controller.connect('team_1', 'linear', ADMIN, answering().response, {
        for: 'someone-else' as 'me',
      }),
    ).rejects.toThrow(
      /A connection must be for team or me\. Received: someone-else/,
    );
    expect(execute).not.toHaveBeenCalled();
  });
});

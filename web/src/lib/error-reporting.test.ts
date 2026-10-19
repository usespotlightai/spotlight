import type { ErrorEvent } from '@sentry/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
}));
const api = vi.hoisted(() => ({ getErrorReporting: vi.fn() }));

vi.mock('@sentry/react', () => sentry);
vi.mock('@/lib/api', () => api);

const {
  errorReportingOptions,
  reportAs,
  scrubbed,
  GatewayError,
  startErrorReporting,
  withGatewayErrorReported,
} = await import('@/lib/error-reporting');

const REPORTING = {
  dsn: 'https://browser@sentry.test/2',
  environment: 'staging',
  release: 'v1.4.0',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('startErrorReporting', () => {
  it('starts nothing and sends nothing when the control plane gives no DSN', async () => {
    const fetching = vi.spyOn(globalThis, 'fetch');
    api.getErrorReporting.mockResolvedValue({
      data: { dsn: null, environment: null, release: null },
    });

    await startErrorReporting();

    expect(sentry.init).not.toHaveBeenCalled();
    expect(fetching).not.toHaveBeenCalled();
  });

  it('starts with the DSN, environment and release from the control plane, and no tracing', async () => {
    api.getErrorReporting.mockResolvedValue({ data: REPORTING });

    await startErrorReporting();

    expect(sentry.init).toHaveBeenCalledOnce();
    const [options] = sentry.init.mock.calls[0] ?? [];
    expect(options).toMatchObject(REPORTING);
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.integrations).toBeUndefined();
    expect(options.dataCollection.userInfo).toBe(false);
  });
});

describe('scrubbed', () => {
  it('keeps no query string, no cookie, no body and no user detail but the id', () => {
    const event = scrubbed({
      type: undefined,
      request: {
        url: 'https://app.test/teams/core?token=secret',
        query_string: 'token=secret',
        cookies: { session: 'secret' },
        data: { password: 'secret' },
        headers: { Referer: 'https://app.test/login?next=secret' },
      },
      user: { id: 'user-1', email: 'sam@acme.test', ip_address: '10.0.0.1' },
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/a?x=secret', to: '/b?y=secret' },
        },
        { category: 'fetch', data: { url: '/api/runs?cursor=secret' } },
      ],
    } as ErrorEvent);

    expect(JSON.stringify(event)).not.toContain('secret');
    expect(event.user).toEqual({ id: 'user-1' });
    expect(event.request?.url).toBe('https://app.test/teams/core');
  });

  it('keeps no token or id in a path, only the route', () => {
    const event = scrubbed({
      type: undefined,
      request: {
        url: 'https://app.test/invites/Zx81kQ_secret',
        headers: { Referer: 'https://app.test/invites/Zx81kQ_secret' },
      },
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/invites/Zx81kQ_secret', to: '/tasks/task_9' },
        },
        { category: 'fetch', data: { url: '/api/invites/Zx81kQ_secret' } },
      ],
    } as ErrorEvent);

    expect(JSON.stringify(event)).not.toContain('secret');
    expect(event.request?.url).toBe('https://app.test/invites/:id');
    expect(event.breadcrumbs?.[0]?.data).toEqual({
      from: '/invites/:id',
      to: '/tasks/:id',
    });
  });

  it('is the hook every event goes through', () => {
    expect(errorReportingOptions(REPORTING).beforeSend).toBe(scrubbed);
  });
});

describe('withGatewayErrorReported', () => {
  const request = new Request(
    'https://app.test/api/workspaces/acme/teams/core/runs/run_8f2c1d?cursor=secret',
    { method: 'GET' },
  );

  it('reports a gateway error once, grouped by its route without names or ids', () => {
    const thrown = { message: 'boom' };

    expect(
      withGatewayErrorReported(
        thrown,
        new Response(null, { status: 503 }),
        request,
      ),
    ).toBe(thrown);

    expect(sentry.captureException).toHaveBeenCalledExactlyOnceWith(
      new GatewayError(
        'GET /api/workspaces/:id/teams/:id/runs/:id answered 503',
      ),
      {
        fingerprint: [
          'gateway-error',
          'GET',
          '/api/workspaces/:id/teams/:id/runs/:id',
        ],
      },
    );
  });

  it('leaves a 500 to the server, and reports no answer a caller caused or network failure', () => {
    withGatewayErrorReported({}, new Response(null, { status: 500 }), request);
    withGatewayErrorReported({}, new Response(null, { status: 404 }), request);
    withGatewayErrorReported({}, undefined, request);

    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('reportAs', () => {
  it('names the person by id only, and nobody after sign-out', () => {
    reportAs('user-1');
    reportAs(null);

    expect(sentry.setUser.mock.calls).toEqual([[{ id: 'user-1' }], [null]]);
  });
});

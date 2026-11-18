import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn<
    (options: {
      tracesSampleRate?: unknown;
      integrations?: unknown;
      dataCollection: { userInfo?: unknown };
    }) => void
  >(),
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

const STORED_REPORTING_KEY = 'spotlight:error-reporting';
const BUILD = import.meta.env.VITE_RELEASE;

const storedAnswer = (): unknown =>
  JSON.parse(localStorage.getItem(STORED_REPORTING_KEY) ?? 'null');

const store = (answer: object) =>
  localStorage.setItem(STORED_REPORTING_KEY, JSON.stringify(answer));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
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

  it('waits for the control plane and stores its answer when nothing is stored', async () => {
    api.getErrorReporting.mockResolvedValue({ data: REPORTING });

    await startErrorReporting();

    expect(api.getErrorReporting).toHaveBeenCalledOnce();
    expect(sentry.init).toHaveBeenCalledOnce();
    expect(storedAnswer()).toEqual({ build: BUILD, ...REPORTING });
  });

  it('starts from the stored answer without waiting for the control plane, and stores the new one for the next load', async () => {
    store({ build: BUILD, ...REPORTING });
    const next = { ...REPORTING, release: 'v1.5.0' };
    let answer: (value: { data: typeof next }) => void = () => undefined;
    api.getErrorReporting.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    await startErrorReporting();

    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject(REPORTING);
    expect(api.getErrorReporting).toHaveBeenCalledOnce();

    answer({ data: next });
    await vi.waitFor(() =>
      expect(storedAnswer()).toEqual({ build: BUILD, ...next }),
    );
    expect(sentry.init).toHaveBeenCalledOnce();
  });

  it('starts nothing from a stored answer without a DSN, and survives a failed refresh', async () => {
    store({ build: BUILD, dsn: null, environment: null, release: null });
    api.getErrorReporting.mockRejectedValue(new TypeError('Failed to fetch'));

    await startErrorReporting();

    expect(sentry.init).not.toHaveBeenCalled();
    expect(api.getErrorReporting).toHaveBeenCalledOnce();
  });

  it('waits for the control plane when the stored answer has the wrong shape', async () => {
    store({ build: BUILD, dsn: 4 });
    api.getErrorReporting.mockResolvedValue({ data: REPORTING });

    await startErrorReporting();

    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject(REPORTING);
  });

  it('waits for the control plane when the stored answer is from another build, so a deploy reports its own release', async () => {
    store({ build: `${BUILD}-previous`, ...REPORTING, release: 'v1.3.0' });
    api.getErrorReporting.mockResolvedValue({ data: REPORTING });

    await startErrorReporting();

    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject(REPORTING);
    expect(storedAnswer()).toEqual({ build: BUILD, ...REPORTING });
  });

  it('waits for the control plane when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    api.getErrorReporting.mockResolvedValue({ data: REPORTING });

    await startErrorReporting();

    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject(REPORTING);
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
    });

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
    });

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

  it('reports a gateway error once, grouped by its status, and tags its route without names or ids', () => {
    const thrown = { message: 'boom' };

    expect(
      withGatewayErrorReported(
        thrown,
        new Response(null, { status: 503 }),
        request,
      ),
    ).toBe(thrown);

    expect(sentry.captureException).toHaveBeenCalledExactlyOnceWith(
      new GatewayError('API answered 503'),
      {
        fingerprint: ['gateway-error', '503'],
        tags: { route: 'GET /api/workspaces/:id/teams/:id/runs/:id' },
      },
    );
  });

  it('groups gateway errors from different routes together', () => {
    withGatewayErrorReported(
      {},
      new Response(null, { status: 502 }),
      new Request('https://app.test/api/workspaces'),
    );
    withGatewayErrorReported(
      {},
      new Response(null, { status: 502 }),
      new Request(
        'https://app.test/api/workspaces/acme/inbox/task_1/317b6c10-fa1f-490d-a874-38959f9065dc',
      ),
    );

    expect(sentry.captureException).toHaveBeenNthCalledWith(
      1,
      new GatewayError('API answered 502'),
      {
        fingerprint: ['gateway-error', '502'],
        tags: { route: 'GET /api/workspaces' },
      },
    );
    expect(sentry.captureException).toHaveBeenNthCalledWith(
      2,
      new GatewayError('API answered 502'),
      {
        fingerprint: ['gateway-error', '502'],
        tags: { route: 'GET /api/workspaces/:id/inbox/:id/:id' },
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

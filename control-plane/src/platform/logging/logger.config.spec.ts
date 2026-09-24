import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildLogging } from '@platform/logging/logger.config';
import pinoHttp, { type Options } from 'pino-http';
import { describe, expect, it } from 'vitest';

const SESSION_TOKEN = 'super-secret-session-token-value';
const SESSION_COOKIE = `better-auth.session_token=${SESSION_TOKEN}`;

type Captured = { lines: Record<string, unknown>[]; raw: string };

async function request(
  path: string,
  headers: Record<string, string> = {},
  through: 'module' | 'auth' = 'module',
): Promise<Captured> {
  const chunks: string[] = [];
  const { params, httpLogger } = buildLogging(
    { NODE_ENV: 'test', LOG_LEVEL: 'info' },
    {
      write: (chunk: string) => {
        chunks.push(chunk);
      },
    },
  );

  const middleware =
    through === 'auth' ? httpLogger : pinoHttp(params.pinoHttp as Options);

  const server: Server = createServer();
  const answered = new Promise<void>((resolve) => {
    server.on('request', (req, res) => {
      middleware(req, res, () => undefined);
      res.on('close', resolve);
      req.log.info('handling request');
      res.setHeader('set-cookie', `${SESSION_COOKIE}; Path=/; HttpOnly`);
      res.end('ok');
    });
  });

  try {
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;
    await Promise.all([
      fetch(`http://127.0.0.1:${port}${path}`, { headers }),
      answered,
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const raw = chunks.join('');
  return { raw, lines: chunks.map((chunk) => JSON.parse(chunk)) };
}

describe('logger config', () => {
  it('never writes session cookies or authorization headers', async () => {
    const { raw, lines } = await request('/api', {
      cookie: SESSION_COOKIE,
      authorization: `Bearer ${SESSION_TOKEN}`,
    });

    expect(raw).not.toContain(SESSION_TOKEN);
    expect(lines[lines.length - 1]).toMatchObject({
      req: {
        headers: { cookie: '[redacted]', authorization: '[redacted]' },
      },
      res: {
        headers: { 'set-cookie': '[redacted]' },
      },
    });
  });

  it('logs method, path, status and duration for each request', async () => {
    const { lines } = await request('/api?name=Leon');
    const completed = lines[lines.length - 1];

    expect(completed).toMatchObject({
      req: { method: 'GET', url: '/api?name=Leon' },
      res: { statusCode: 200 },
    });
    expect(completed?.responseTime).toBeTypeOf('number');
  });

  it('tags every line of a request with the same request id', async () => {
    const { lines } = await request('/api');
    const ids = lines.map((line) => line.reqId);

    expect(lines.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBeTypeOf('string');
  });

  it('adopts the trace id the proxy issued', async () => {
    const traceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const { lines } = await request('/api', {
      traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
    });

    expect(lines[0].reqId).toBe(traceId);
  });

  it.each([
    ['malformed', 'not-a-traceparent'],
    ['injected text', `00-${'a'.repeat(32)}-00f067aa0ba902b7-01 rogue`],
    ['wrong trace id length', '00-abcdef-00f067aa0ba902b7-01'],
    ['the all-zero trace id', `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`],
  ])('falls back to a generated id given %s', async (_name, traceparent) => {
    const { lines } = await request('/api', { traceparent });
    const reqId = lines[0].reqId as string;

    expect(reqId).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/,
    );
  });

  it('sends the auth wrapper to the same sink as the module logger', async () => {
    const { lines } = await request('/api/auth/get-session', {}, 'auth');

    expect(lines[lines.length - 1]).toMatchObject({
      req: { method: 'GET', url: '/api/auth/get-session' },
      res: { statusCode: 200 },
    });
    expect(lines[0].reqId).toBeTypeOf('string');
  });

  it('does not log liveness probes', async () => {
    const { lines } = await request('/api/health');

    expect(lines.map((line) => line.msg)).toEqual(['handling request']);
  });
});

import type { INestApplication } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { sentryOptions } from '@platform/errors/sentry-options';
import {
  close,
  type ErrorEvent,
  flush,
  httpIntegration,
  init,
  requestDataIntegration,
} from '@sentry/nestjs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { openApp, served } from './support/app';

type SentEnvelope = [unknown, [{ type: string }, unknown][]];

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const SECRETS = [
  'cookie-secret',
  'bearer-secret',
  'query-secret',
  'body-secret',
];

describe('error reporting', () => {
  describe('without a DSN', () => {
    let app: INestApplication;

    beforeAll(async () => {
      vi.stubEnv('SENTRY_DSN', '');
      vi.stubEnv('SENTRY_WEB_DSN', '');
      app = await openApp();
    });

    afterAll(async () => {
      await app.close();
      vi.unstubAllEnvs();
    });

    it('tells the web app that it reports nothing', async () => {
      const { body } = await served(app)
        .get('/api/error-reporting')
        .expect(200);

      expect(body).toEqual({ dsn: null, environment: null, release: null });
    });
  });

  describe('with a DSN', () => {
    const envelopes: SentEnvelope[] = [];
    let app: INestApplication;

    beforeAll(async () => {
      vi.stubEnv('SENTRY_DSN', 'https://server@sentry.invalid/1');
      vi.stubEnv('SENTRY_WEB_DSN', 'https://browser@sentry.invalid/2');
      vi.stubEnv('SENTRY_ENVIRONMENT', 'e2e');
      vi.stubEnv('SPOTLIGHT_RELEASE', 'v9.9.9');

      init({
        ...sentryOptions(process.env),
        defaultIntegrations: false,
        integrations: [httpIntegration(), requestDataIntegration()],
        transport: () => ({
          send: async (envelope) => {
            envelopes.push(envelope as unknown as SentEnvelope);
            return {};
          },
          flush: async () => true,
        }),
      });

      app = await openApp((module, env) =>
        module.overrideProvider(ENV).useValue(
          new Proxy(env, {
            get: (target, key) => {
              if (key === 'SENTRY_ENVIRONMENT' && failing) {
                throw new Error('the settings could not be read');
              }
              return Reflect.get(target, key);
            },
          }),
        ),
      );
    });

    let failing = false;

    afterAll(async () => {
      await app.close();
      await close();
      vi.unstubAllEnvs();
    });

    const events = (): ErrorEvent[] =>
      envelopes.flatMap(([, items]) =>
        items
          .filter(([header]) => header.type === 'event')
          .map(([, payload]) => payload as ErrorEvent),
      );

    it('gives the web app its DSN, environment and release', async () => {
      const { body } = await served(app)
        .get('/api/error-reporting')
        .expect(200);

      expect(body).toEqual({
        dsn: 'https://browser@sentry.invalid/2',
        environment: 'e2e',
        release: 'v9.9.9',
      });
    });

    it('reports a 500 once, with release, environment and trace id, and none of the secrets', async () => {
      failing = true;
      await served(app)
        .get('/api/error-reporting?token=query-secret')
        .set('x-test-user', 'user-1')
        .set('Cookie', 'session=cookie-secret')
        .set('Authorization', 'Bearer bearer-secret')
        .set('traceparent', `00-${TRACE_ID}-00f067aa0ba902b7-01`)
        .send({ password: 'body-secret' })
        .expect(500);
      failing = false;
      await flush(2000);

      const reported = events();
      expect(reported).toHaveLength(1);

      const [event] = reported;
      expect(event?.exception?.values?.[0]?.value).toBe(
        'the settings could not be read',
      );
      expect(event?.release).toBe('v9.9.9');
      expect(event?.environment).toBe('e2e');
      expect(event?.contexts?.trace?.trace_id).toBe(TRACE_ID);
      expect(event?.request?.url).toMatch(/\/api\/error-reporting$/);

      const sent = JSON.stringify(event);
      for (const secret of SECRETS) {
        expect(sent).not.toContain(secret);
      }
    });

    it('reports no answer a caller caused', async () => {
      const before = events().length;

      await served(app).get('/api/no-such-route').expect(404);
      await flush(2000);

      expect(events()).toHaveLength(before);
    });
  });
});

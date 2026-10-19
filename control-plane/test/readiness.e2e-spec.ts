import type { INestApplication } from '@nestjs/common';
import { PostgresReadiness } from '@platform/health/postgres-readiness';
import { ReadinessChecks } from '@platform/health/readiness-checks';
import { S3Readiness } from '@work/infrastructure/storage/s3-readiness';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served } from './support/app';

const reachableS3 = { name: 's3', check: async () => undefined };

describe('readiness', () => {
  describe('with Postgres and S3 reachable', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await openApp((module) =>
        module.overrideProvider(S3Readiness).useFactory({
          inject: [ReadinessChecks],
          factory: (checks: ReadinessChecks) => {
            checks.register(reachableS3);
            return reachableS3;
          },
        }),
      );
    });

    afterAll(() => app.close());

    it('is ready', async () => {
      const { body } = await served(app).get('/api/health/ready').expect(200);

      expect(body).toEqual({
        status: 'ready',
        checks: [
          { name: 'postgres', status: 'ok' },
          { name: 's3', status: 'ok' },
        ],
      });
    });
  });

  describe('with Postgres unreachable', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await openApp((module) =>
        module
          .overrideProvider(PostgresReadiness)
          .useFactory({
            inject: [ReadinessChecks],
            factory: (checks: ReadinessChecks) => {
              const postgres = new PostgresReadiness(
                'postgres://spotlight@127.0.0.1:1/spotlight',
              );
              checks.register(postgres);
              return postgres;
            },
          })
          .overrideProvider(S3Readiness)
          .useFactory({
            inject: [ReadinessChecks],
            factory: (checks: ReadinessChecks) => {
              checks.register(reachableS3);
              return reachableS3;
            },
          }),
      );
    });

    afterAll(() => app.close());

    it('is not ready within 2 seconds and names the failed check', async () => {
      const started = Date.now();
      const { body } = await served(app).get('/api/health/ready').expect(503);

      expect(Date.now() - started).toBeLessThan(2_000);
      expect(body).toEqual({
        status: 'not_ready',
        checks: [
          { name: 'postgres', status: 'failed' },
          { name: 's3', status: 'ok' },
        ],
      });
    });
  });
});

import { databaseSchema, envSchema } from '@platform/config/env.schema';
import { describe, expect, it } from 'vitest';

const url = 'postgres://localhost/spotlight';

describe('databaseSchema pool limits', () => {
  it('defaults the pool size and timeouts', () => {
    expect(databaseSchema.parse({ DATABASE_URL: url })).toMatchObject({
      DATABASE_POOL_MAX: 10,
      DATABASE_CONNECTION_TIMEOUT_MS: 5_000,
      DATABASE_IDLE_TIMEOUT_MS: 30_000,
    });
  });

  it.each([
    'DATABASE_POOL_MAX',
    'DATABASE_CONNECTION_TIMEOUT_MS',
    'DATABASE_IDLE_TIMEOUT_MS',
  ])('rejects zero and negative values for %s', (key) => {
    expect(
      databaseSchema.safeParse({ DATABASE_URL: url, [key]: '0' }).success,
    ).toBe(false);
    expect(
      databaseSchema.safeParse({ DATABASE_URL: url, [key]: '-1' }).success,
    ).toBe(false);
  });
});

describe('envSchema platform pool', () => {
  const required = {
    DATABASE_URL: url,
    BETTER_AUTH_SECRET: 'b'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    GITHUB_CLIENT_ID: 'id',
    GITHUB_CLIENT_SECRET: 'secret',
    GITHUB_APP_ID: 'app',
    GITHUB_APP_PRIVATE_KEY: 'key',
    SPOTLIGHT_SECRETS_KEY: 'k',
    S3_BUCKET: 'files',
  };
  const SECRET = `whsec_${Buffer.from('p'.repeat(32)).toString('base64')}`;

  it('adds no platform pool when the URL is empty', () => {
    expect(
      envSchema.parse({ ...required, SPOTLIGHT_PLATFORM_POOL_URL: '' }),
    ).toMatchObject({
      SPOTLIGHT_PLATFORM_POOL_URL: undefined,
      SPOTLIGHT_PLATFORM_POOL_LABELS: [],
    });
  });

  it('takes the URL and the secret together, or neither', () => {
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_PLATFORM_POOL_URL: 'https://provision.example.com/runs',
        SPOTLIGHT_PLATFORM_POOL_SECRET: SECRET,
      }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_PLATFORM_POOL_URL: 'https://provision.example.com/runs',
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_PLATFORM_POOL_SECRET: SECRET,
      }).success,
    ).toBe(false);
  });

  it('refuses a secret that is not whsec_ and base64', () => {
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_PLATFORM_POOL_URL: 'https://provision.example.com/runs',
        SPOTLIGHT_PLATFORM_POOL_SECRET: 'not-a-secret',
      }).success,
    ).toBe(false);
  });

  it('names the platform egress only where the deployment has one', () => {
    const platform = {
      ...required,
      SPOTLIGHT_PLATFORM_POOL_URL: 'https://provision.example.com/runs',
      SPOTLIGHT_PLATFORM_POOL_SECRET: SECRET,
      SPOTLIGHT_PLATFORM_POOL_EGRESS: 'spotlight',
    };

    expect(envSchema.safeParse(platform).success).toBe(false);
    expect(
      envSchema.safeParse({
        ...platform,
        SPOTLIGHT_PLATFORM_EGRESS_URL: 'https://egress.example.com',
        SPOTLIGHT_PLATFORM_EGRESS_TOKEN: 't'.repeat(32),
      }).success,
    ).toBe(true);
  });

  it('reads the labels as a list, and refuses one that is not a label or is named twice', () => {
    const withUrl = {
      ...required,
      SPOTLIGHT_PLATFORM_POOL_URL: 'https://provision.example.com/runs',
      SPOTLIGHT_PLATFORM_POOL_SECRET: SECRET,
    };

    expect(
      envSchema.parse({
        ...withUrl,
        SPOTLIGHT_PLATFORM_POOL_LABELS: ' linux, gpu ,',
      }).SPOTLIGHT_PLATFORM_POOL_LABELS,
    ).toEqual(['linux', 'gpu']);
    expect(
      envSchema.safeParse({
        ...withUrl,
        SPOTLIGHT_PLATFORM_POOL_LABELS: 'Linux',
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...withUrl,
        SPOTLIGHT_PLATFORM_POOL_LABELS: 'gpu,gpu',
      }).success,
    ).toBe(false);
  });

  it('refuses labels or an egress for the platform pool with no URL', () => {
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_PLATFORM_POOL_LABELS: 'gpu',
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_PLATFORM_EGRESS_URL: 'https://egress.example.com',
        SPOTLIGHT_PLATFORM_EGRESS_TOKEN: 't'.repeat(32),
        SPOTLIGHT_PLATFORM_POOL_EGRESS: 'spotlight',
      }).success,
    ).toBe(false);
  });
});

describe('envSchema event webhook', () => {
  const required = {
    DATABASE_URL: url,
    BETTER_AUTH_SECRET: 'b'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    GITHUB_CLIENT_ID: 'id',
    GITHUB_CLIENT_SECRET: 'secret',
    GITHUB_APP_ID: 'app',
    GITHUB_APP_PRIVATE_KEY: 'key',
    SPOTLIGHT_SECRETS_KEY: 'k',
    S3_BUCKET: 'files',
  };
  const SECRET = `whsec_${Buffer.from('e'.repeat(32)).toString('base64')}`;
  const webhook = {
    ...required,
    SPOTLIGHT_EVENTS_URL: 'https://events.example.com/spotlight',
    SPOTLIGHT_EVENTS_SECRET: SECRET,
  };

  it('sends no events when the URL is empty', () => {
    expect(
      envSchema.parse({ ...required, SPOTLIGHT_EVENTS_URL: '' }),
    ).toMatchObject({
      SPOTLIGHT_EVENTS_URL: undefined,
      SPOTLIGHT_EVENTS_KINDS: [],
    });
  });

  it('takes the URL and the secret together, or neither', () => {
    expect(envSchema.safeParse(webhook).success).toBe(true);
    expect(
      envSchema.safeParse({ ...webhook, SPOTLIGHT_EVENTS_SECRET: undefined })
        .success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ ...required, SPOTLIGHT_EVENTS_SECRET: SECRET })
        .success,
    ).toBe(false);
  });

  it('refuses a URL that is not HTTPS, and a secret that is not whsec_ and base64', () => {
    expect(
      envSchema.safeParse({
        ...webhook,
        SPOTLIGHT_EVENTS_URL: 'http://events.example.com',
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ ...webhook, SPOTLIGHT_EVENTS_SECRET: 'secret' })
        .success,
    ).toBe(false);
  });

  it('reads the kinds as a list of kinds or starts of kinds, and refuses another value', () => {
    expect(
      envSchema.parse({
        ...webhook,
        SPOTLIGHT_EVENTS_KINDS:
          ' identity., runs.run-usage-recorded.v1 ,work.task-',
      }).SPOTLIGHT_EVENTS_KINDS,
    ).toEqual(['identity.', 'runs.run-usage-recorded.v1', 'work.task-']);

    for (const kinds of ['identity', 'Identity.', '*', 'runs.run-ended.v']) {
      expect(
        envSchema.safeParse({ ...webhook, SPOTLIGHT_EVENTS_KINDS: kinds })
          .success,
      ).toBe(false);
    }
  });

  it('refuses kinds with no URL', () => {
    expect(
      envSchema.safeParse({ ...required, SPOTLIGHT_EVENTS_KINDS: 'identity.' })
        .success,
    ).toBe(false);
  });
});

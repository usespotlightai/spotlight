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

describe('envSchema managed pool', () => {
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

  it('adds no managed pool when the URL is empty', () => {
    expect(
      envSchema.parse({ ...required, SPOTLIGHT_MANAGED_POOL_URL: '' }),
    ).toMatchObject({
      SPOTLIGHT_MANAGED_POOL_URL: undefined,
      SPOTLIGHT_MANAGED_POOL_LABELS: '',
    });
  });

  it('takes the URL and the secret together, or neither', () => {
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_MANAGED_POOL_URL: 'https://provision.example.com/runs',
        SPOTLIGHT_MANAGED_POOL_SECRET: SECRET,
      }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_MANAGED_POOL_URL: 'https://provision.example.com/runs',
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_MANAGED_POOL_SECRET: SECRET,
      }).success,
    ).toBe(false);
  });

  it('refuses a secret that is not whsec_ and base64', () => {
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_MANAGED_POOL_URL: 'https://provision.example.com/runs',
        SPOTLIGHT_MANAGED_POOL_SECRET: 'not-a-secret',
      }).success,
    ).toBe(false);
  });

  it('names the platform egress only where the deployment has one', () => {
    const managed = {
      ...required,
      SPOTLIGHT_MANAGED_POOL_URL: 'https://provision.example.com/runs',
      SPOTLIGHT_MANAGED_POOL_SECRET: SECRET,
      SPOTLIGHT_MANAGED_POOL_EGRESS: 'spotlight',
    };

    expect(envSchema.safeParse(managed).success).toBe(false);
    expect(
      envSchema.safeParse({
        ...managed,
        SPOTLIGHT_PLATFORM_EGRESS_URL: 'https://egress.example.com',
        SPOTLIGHT_PLATFORM_EGRESS_TOKEN: 't'.repeat(32),
      }).success,
    ).toBe(true);
  });
});

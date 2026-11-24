import { databaseSchema, envSchema } from '@platform/config/env.schema';
import { SIGNING_SECRET_RULE } from '@shared-kernel/domain/value-objects/signing-secret.vo';
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

  it('refuses a platform pool secret of more than 64 bytes, and says what a secret must be', () => {
    const parsed = envSchema.safeParse({
      ...required,
      SPOTLIGHT_PLATFORM_POOL_URL: 'https://provision.example.com/runs',
      SPOTLIGHT_PLATFORM_POOL_SECRET: `whsec_${Buffer.alloc(65, 1).toString('base64')}`,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((each) => each.message)).toContain(
      SIGNING_SECRET_RULE,
    );
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
      envSchema.parse({
        ...withUrl,
        SPOTLIGHT_PLATFORM_POOL_ALLOWS: 'secrets, review-work',
      }).SPOTLIGHT_PLATFORM_POOL_ALLOWS,
    ).toEqual(['secrets', 'review-work']);
    expect(envSchema.parse(withUrl).SPOTLIGHT_PLATFORM_POOL_ALLOWS).toEqual([]);
    expect(
      envSchema.safeParse({
        ...withUrl,
        SPOTLIGHT_PLATFORM_POOL_ALLOWS: 'everything',
      }).success,
    ).toBe(false);
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
    SPOTLIGHT_EVENT_WEBHOOK_URL: 'https://events.example.com/spotlight',
    SPOTLIGHT_EVENT_WEBHOOK_SECRET: SECRET,
  };

  it('sends no events when the URL is empty', () => {
    expect(
      envSchema.parse({ ...required, SPOTLIGHT_EVENT_WEBHOOK_URL: '' }),
    ).toMatchObject({
      SPOTLIGHT_EVENT_WEBHOOK_URL: undefined,
      SPOTLIGHT_EVENT_WEBHOOK_KINDS: [],
    });
  });

  it('takes the URL and the secret together, or neither', () => {
    expect(envSchema.safeParse(webhook).success).toBe(true);
    expect(
      envSchema.safeParse({
        ...webhook,
        SPOTLIGHT_EVENT_WEBHOOK_SECRET: undefined,
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_EVENT_WEBHOOK_SECRET: SECRET,
      }).success,
    ).toBe(false);
  });

  it('refuses a URL that is not HTTPS, and a secret that is not whsec_ and base64', () => {
    expect(
      envSchema.safeParse({
        ...webhook,
        SPOTLIGHT_EVENT_WEBHOOK_URL: 'http://events.example.com',
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...webhook,
        SPOTLIGHT_EVENT_WEBHOOK_SECRET: 'secret',
      }).success,
    ).toBe(false);
  });

  it('refuses a secret of more than 64 bytes, and says what a secret must be', () => {
    const parsed = envSchema.safeParse({
      ...webhook,
      SPOTLIGHT_EVENT_WEBHOOK_SECRET: `whsec_${Buffer.alloc(65, 1).toString('base64')}`,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((each) => each.message)).toContain(
      SIGNING_SECRET_RULE,
    );
  });

  it('reads the kinds as a list of kinds or contexts, and refuses another value', () => {
    expect(
      envSchema.parse({
        ...webhook,
        SPOTLIGHT_EVENT_WEBHOOK_KINDS:
          ' identity., runs.run-usage-recorded.v1 ,',
      }).SPOTLIGHT_EVENT_WEBHOOK_KINDS,
    ).toEqual(['identity.', 'runs.run-usage-recorded.v1']);

    for (const kinds of [
      'identity',
      'Identity.',
      '*',
      'runs.run-ended.v',
      'identity.workspace',
      'work.task-',
    ]) {
      expect(
        envSchema.safeParse({
          ...webhook,
          SPOTLIGHT_EVENT_WEBHOOK_KINDS: kinds,
        }).success,
      ).toBe(false);
    }
  });

  it('refuses kinds with no URL', () => {
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_EVENT_WEBHOOK_KINDS: 'identity.',
      }).success,
    ).toBe(false);
  });
});

describe('envSchema custom settings pages', () => {
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

  it('adds no custom settings pages when the value is not set', () => {
    expect(envSchema.parse(required).SPOTLIGHT_CUSTOM_SETTINGS_PAGES).toEqual(
      [],
    );
  });

  it('takes the custom settings pages in JSON', () => {
    expect(
      envSchema.parse({
        ...required,
        SPOTLIGHT_CUSTOM_SETTINGS_PAGES:
          '[{"id":"handbook","label":"Handbook","roles":["owner"],"script":"/handbook/element.js","element":"x-handbook-page"}]',
      }).SPOTLIGHT_CUSTOM_SETTINGS_PAGES,
    ).toEqual([
      {
        id: 'handbook',
        label: 'Handbook',
        group: 'workspace',
        roles: ['owner'],
        script: '/handbook/element.js',
        element: 'x-handbook-page',
      },
    ]);
  });

  it('refuses a script on another origin', () => {
    expect(
      envSchema.safeParse({
        ...required,
        SPOTLIGHT_CUSTOM_SETTINGS_PAGES:
          '[{"id":"handbook","label":"Handbook","script":"https://cdn.example.com/element.js","element":"x-handbook-page"}]',
      }).success,
    ).toBe(false);
  });
});

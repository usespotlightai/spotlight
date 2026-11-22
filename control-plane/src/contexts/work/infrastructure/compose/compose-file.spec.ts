import {
  composeServicesOf,
  durationMs,
  envFileOf,
  interpolated,
  words,
} from '@work/infrastructure/compose/compose-file';
import { describe, expect, it } from 'vitest';

const COMPOSE = `
services:
  web:
    build: .
    ports: ["3000:3000"]
    depends_on: [db]
  worker:
    image: acme/worker:1
    command: node worker.js --queue "slow jobs"
    depends_on:
      cache:
        condition: service_started
      db:
        condition: service_healthy
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: \${DB_PASSWORD:-local}
      POSTGRES_DB: app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 1m30s
      retries: 10
      start_period: 500ms
    volumes: ["./init.sql:/docker-entrypoint-initdb.d/init.sql"]
  cache:
    image: redis:7
    environment: ["MODE=lru", "not a pair"]
    healthcheck:
      disable: true
  tools:
    image: acme/tools
    profiles: [debug]
`;

describe('composeServicesOf', () => {
  it('reads the services a run can start from an image, each after the ones it depends on', () => {
    const { services, leftOut } = composeServicesOf(COMPOSE, 'app/compose.yml');

    expect(services).toEqual([
      {
        name: 'cache',
        image: 'redis:7',
        env: [{ name: 'MODE', value: 'lru' }],
        health: { test: ['NONE'] },
        from: 'app/compose.yml',
      },
      {
        name: 'db',
        image: 'postgres:17',
        env: [
          { name: 'POSTGRES_PASSWORD', value: 'local' },
          { name: 'POSTGRES_DB', value: 'app' },
        ],
        health: {
          test: ['CMD-SHELL', 'pg_isready -U postgres'],
          intervalMs: 2000,
          timeoutMs: 90_000,
          startPeriodMs: 500,
          retries: 10,
        },
        from: 'app/compose.yml',
      },
      {
        name: 'worker',
        image: 'acme/worker:1',
        command: ['node', 'worker.js', '--queue', 'slow jobs'],
        dependsOn: ['cache', 'db'],
        from: 'app/compose.yml',
      },
    ]);
    expect(leftOut).toEqual([
      { name: 'web', why: 'it builds its own image' },
      { name: 'tools', why: 'it only starts under a profile' },
    ]);
  });

  it('fills in values from the .env file beside it', () => {
    const { services } = composeServicesOf(
      COMPOSE,
      'compose.yml',
      envFileOf('# local\nDB_PASSWORD="from file"\n'),
    );

    expect(services.find((each) => each.name === 'db')?.env?.[0]).toEqual({
      name: 'POSTGRES_PASSWORD',
      value: 'from file',
    });
  });

  it('leaves out a service that depends on one left out or on itself', () => {
    const { services, leftOut } = composeServicesOf(
      `
services:
  api: { image: api, depends_on: [web] }
  web: { build: . }
  a: { image: a, depends_on: [b] }
  b: { image: b, depends_on: [a] }
  ok: { image: ok }
`,
      'compose.yml',
    );

    expect(services.map((each) => each.name)).toEqual(['ok']);
    expect(leftOut.map((each) => each.name).sort()).toEqual([
      'a',
      'api',
      'b',
      'web',
    ]);
  });

  it('finds nothing in a file without services, and says when the file is not YAML', () => {
    expect(composeServicesOf('version: "3"\n', 'compose.yml')).toEqual({
      services: [],
      leftOut: [],
    });
    expect(composeServicesOf('services: [', 'compose.yml').leftOut).toEqual([
      { name: 'compose.yml', why: 'it is not YAML' },
    ]);
  });
});

describe('the pieces of a Compose file', () => {
  it('interpolates as Compose does', () => {
    const env = new Map([
      ['SET', 'yes'],
      ['EMPTY', ''],
    ]);

    expect(
      interpolated(
        `$SET \${SET} \${UNSET:-a} \${EMPTY:-b} \${EMPTY-c} \${UNSET} $$HOME`,
        env,
      ),
    ).toBe('yes yes a b   $HOME');
  });

  it('splits a command as a shell would', () => {
    expect(words(`sh -c 'echo "hi there"' ""`)).toEqual([
      'sh',
      '-c',
      'echo "hi there"',
      '',
    ]);
  });

  it('reads durations', () => {
    expect(durationMs('1h2m3s')).toBe(3_723_000);
    expect(durationMs('soon')).toBeNull();
  });
});

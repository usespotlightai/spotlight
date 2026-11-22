import {
  declaredServicesOf,
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

describe('declaredServicesOf', () => {
  it('translates each service as the file declares it, deciding nothing', () => {
    expect(declaredServicesOf(COMPOSE)).toEqual([
      {
        name: 'web',
        image: null,
        builds: true,
        profiled: false,
        command: null,
        env: [],
        health: null,
        dependsOn: ['db'],
      },
      {
        name: 'worker',
        image: 'acme/worker:1',
        builds: false,
        profiled: false,
        command: ['node', 'worker.js', '--queue', 'slow jobs'],
        env: [],
        health: null,
        dependsOn: ['cache', 'db'],
      },
      {
        name: 'db',
        image: 'postgres:17',
        builds: false,
        profiled: false,
        command: null,
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
        dependsOn: [],
      },
      {
        name: 'cache',
        image: 'redis:7',
        builds: false,
        profiled: false,
        command: null,
        env: [{ name: 'MODE', value: 'lru' }],
        health: { test: ['NONE'] },
        dependsOn: [],
      },
      {
        name: 'tools',
        image: 'acme/tools',
        builds: false,
        profiled: true,
        command: null,
        env: [],
        health: null,
        dependsOn: [],
      },
    ]);
  });

  it('fills in values from the .env file beside it', () => {
    const db = declaredServicesOf(
      COMPOSE,
      envFileOf('# local\nDB_PASSWORD="from file"\n'),
    )?.find((each) => each.name === 'db');

    expect(db?.env[0]).toEqual({
      name: 'POSTGRES_PASSWORD',
      value: 'from file',
    });
  });

  it('declares nothing in a file without services, and cannot read a file that is not YAML', () => {
    expect(declaredServicesOf('version: "3"\n')).toEqual([]);
    expect(declaredServicesOf('services: [')).toBeNull();
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

import {
  type ComposeFile,
  preferredComposeFile,
  servicesToStart,
} from '@work/domain/services/compose-services';
import { declared } from '@work/domain/services/compose-services.fake-spec';
import { describe, expect, it } from 'vitest';

const file = (
  from: string,
  services: ComposeFile['services'],
  name = from.split('/').pop() ?? from,
): ComposeFile => ({ from, name, services });

describe('servicesToStart', () => {
  it('starts the services that run from an image, each after the ones it depends on, and says why it leaves out the rest', () => {
    const started = servicesToStart(
      [
        [
          file('api/compose.yml', [
            declared({ name: 'web', image: null, builds: true }),
            declared({ name: 'worker', dependsOn: ['cache', 'db'] }),
            declared({
              name: 'db',
              image: ' postgres:17 ',
              env: [
                { name: 'POSTGRES_DB', value: 'app' },
                { name: 'not a name', value: 'x' },
              ],
              health: { test: ['CMD-SHELL', 'pg_isready'], retries: 3 },
            }),
            declared({ name: 'cache' }),
            declared({ name: 'tools', profiled: true }),
            declared({ name: 'no image', image: null }),
            declared({ name: 'bare', image: ' ' }),
          ]),
        ],
      ],
      16,
    );

    expect(started.services).toEqual([
      { name: 'cache', image: 'cache:1', from: 'api/compose.yml' },
      {
        name: 'db',
        image: 'postgres:17',
        env: [{ name: 'POSTGRES_DB', value: 'app' }],
        health: { test: ['CMD-SHELL', 'pg_isready'], retries: 3 },
        from: 'api/compose.yml',
      },
      {
        name: 'worker',
        image: 'worker:1',
        dependsOn: ['cache', 'db'],
        from: 'api/compose.yml',
      },
    ]);
    expect(started.leftOut.map(({ name, why }) => [name, why])).toEqual([
      ['web', 'it builds its own image'],
      ['tools', 'it only starts under a profile'],
      ['no image', 'its name cannot be a host name'],
      ['bare', 'it names no image'],
    ]);
  });

  it('leaves out a service that depends on one left out, or on itself through others', () => {
    const { services, leftOut } = servicesToStart(
      [
        [
          file('compose.yml', [
            declared({ name: 'api', dependsOn: ['web'] }),
            declared({ name: 'web', builds: true }),
            declared({ name: 'a', dependsOn: ['b'] }),
            declared({ name: 'b', dependsOn: ['a'] }),
            declared({ name: 'ok' }),
          ]),
        ],
      ],
      16,
    );

    expect(services.map((each) => each.name)).toEqual(['ok']);
    expect(leftOut.map((each) => each.name).sort()).toEqual([
      'a',
      'api',
      'b',
      'web',
    ]);
  });

  it('reads the preferred file of each checkout, keeps the first service of a name, and starts at most the most a run starts', () => {
    const { services, leftOut } = servicesToStart(
      [
        [
          file('api/docker-compose.yml', [declared({ name: 'old' })]),
          file('api/compose.yaml', [declared({ name: 'db' })]),
        ],
        [
          file('web/compose.yml', [
            declared({ name: 'db', image: 'mysql:8' }),
            declared({ name: 'cache' }),
            declared({ name: 'queue' }),
            declared({ name: 'worker', dependsOn: ['queue'] }),
          ]),
        ],
        [file('docs/compose.yml', null)],
      ],
      2,
    );

    expect(services).toEqual([
      { name: 'db', image: 'db:1', from: 'api/compose.yaml' },
      { name: 'cache', image: 'cache:1', from: 'web/compose.yml' },
    ]);
    expect(leftOut.map(({ name, from, why }) => [name, from, why])).toEqual([
      ['db', 'web/compose.yml', 'another checkout has a service of that name'],
      ['queue', 'web/compose.yml', 'a run starts at most 2 services'],
      [
        'worker',
        'web/compose.yml',
        'it depends on queue, which does not start',
      ],
      ['compose.yml', 'docs/compose.yml', 'it is not YAML'],
    ]);
  });
});

describe('preferredComposeFile', () => {
  it('prefers the file Compose itself reads first, and finds none where there is none', () => {
    expect(
      preferredComposeFile([
        file('docker-compose.yml', []),
        file('compose.yml', []),
      ])?.name,
    ).toBe('compose.yml');
    expect(preferredComposeFile([])).toBeNull();
  });
});

import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunServices } from '@work/application/services/run-services';
import { declared } from '@work/domain/services/compose-services.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const logger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe('RunServices', () => {
  it('starts what the Compose files of the checkouts allow, and logs what it leaves out', async () => {
    const log = logger();
    const services = new RunServices(
      {
        at: async (_workspace, { repository }) =>
          repository.value === 'acme/api'
            ? [
                {
                  from: 'api/compose.yml',
                  name: 'compose.yml',
                  services: [
                    declared({ name: 'db', image: 'postgres:17' }),
                    declared({ name: 'app', builds: true }),
                  ],
                },
              ]
            : [],
      },
      log,
    );

    expect(
      await services.of(WORKSPACE, [
        { repository: Repository.of('acme/api'), ref: 'main' },
        { repository: Repository.of('acme/web'), ref: null },
      ]),
    ).toEqual([{ name: 'db', image: 'postgres:17', from: 'api/compose.yml' }]);
    expect(log.info.mock.calls[0]?.[0]).toMatchObject({
      leftOut: [
        {
          name: 'app',
          from: 'api/compose.yml',
          why: 'it builds its own image',
        },
      ],
    });
  });

  it('orders the run without the services of a checkout whose files cannot be read', async () => {
    const log = logger();
    const services = new RunServices(
      {
        at: async () => {
          throw new Error('GitHub is down');
        },
      },
      log,
    );

    expect(
      await services.of(WORKSPACE, [
        { repository: Repository.of('acme/api'), ref: null },
      ]),
    ).toEqual([]);
    expect(log.warn).toHaveBeenCalledOnce();
  });
});

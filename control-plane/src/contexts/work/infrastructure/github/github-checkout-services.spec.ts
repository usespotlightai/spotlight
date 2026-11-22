import type {
  RepositoryContentsPort,
  RepositoryFileContent,
} from '@github/application/ports/repository-contents.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { GitHubCheckoutServices } from '@work/infrastructure/github/github-checkout-services';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const checkout = (
  repository: string,
  ref: string | null = 'fix/the-queue',
) => ({
  repository: Repository.of(repository),
  ref,
});

const logger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

const servicesFrom = (
  files: Record<string, readonly RepositoryFileContent[] | Error>,
) => {
  const asked: { repository: string; ref: string | null }[] = [];
  const contents = {
    topFiles: async (_workspace, repository, _names, ref) => {
      asked.push({ repository: repository.value, ref });
      const found = files[repository.value] ?? [];
      if (found instanceof Error) {
        throw found;
      }
      return { ref: ref ?? 'main', files: found };
    },
  } as Pick<RepositoryContentsPort, 'topFiles'> as RepositoryContentsPort;
  return { contents, asked };
};

describe('GitHubCheckoutServices', () => {
  it('reads the preferred Compose file of each checkout at its branch, with the .env beside it', async () => {
    const { contents, asked } = servicesFrom({
      'acme/api': [
        {
          path: 'docker-compose.yml',
          content: 'services: { old: { image: old } }',
        },
        {
          path: 'compose.yaml',
          content: `services:\n  db:\n    image: postgres:\${PG:-16}\n`,
        },
        { path: '.env', content: 'PG=17\n' },
      ],
      'acme/web': [
        {
          path: 'compose.yml',
          content:
            'services:\n  cache: { image: redis:7 }\n  db: { image: mysql:8 }\n  app: { build: . }\n',
        },
      ],
    });
    const log = logger();

    const services = await new GitHubCheckoutServices(contents, log).of(
      WORKSPACE,
      [checkout('acme/api'), checkout('acme/web', 'abc123')],
    );

    expect(asked).toEqual([
      { repository: 'acme/api', ref: 'fix/the-queue' },
      { repository: 'acme/web', ref: 'abc123' },
    ]);
    expect(services).toEqual([
      { name: 'db', image: 'postgres:17', from: 'api/compose.yaml' },
      { name: 'cache', image: 'redis:7', from: 'web/compose.yml' },
    ]);
    expect(log.info.mock.calls[0]?.[0]).toMatchObject({
      leftOut: [
        {
          name: 'db',
          from: 'web/compose.yml',
          why: 'another checkout has a service of that name',
        },
        {
          name: 'app',
          from: 'web/compose.yml',
          why: 'it builds its own image',
        },
      ],
    });
  });

  it('orders the run without services where a Compose file cannot be read', async () => {
    const { contents } = servicesFrom({
      'acme/api': new Error('GitHub is down'),
      'acme/web': [
        {
          path: 'compose.yml',
          content: 'services: { cache: { image: redis } }',
        },
      ],
    });
    const log = logger();

    const services = await new GitHubCheckoutServices(contents, log).of(
      WORKSPACE,
      [checkout('acme/api'), checkout('acme/web')],
    );

    expect(services.map((each) => each.name)).toEqual(['cache']);
    expect(log.warn).toHaveBeenCalledOnce();
  });
});

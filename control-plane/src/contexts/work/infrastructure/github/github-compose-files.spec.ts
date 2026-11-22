import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { GitHubComposeFiles } from '@work/infrastructure/github/github-compose-files';
import { describe, expect, it } from 'vitest';

describe('GitHubComposeFiles', () => {
  it('reads each Compose file at the top of a checkout at its ref, with the .env beside them', async () => {
    const asked: { names: readonly string[]; ref: string | null }[] = [];
    const contents = {
      topFiles: async (_workspace, _repository, names, ref) => {
        asked.push({ names, ref });
        return {
          ref: ref ?? 'main',
          files: [
            {
              path: 'compose.yaml',
              content: `services:\n  db:\n    image: postgres:\${PG:-16}\n`,
            },
            { path: 'docker-compose.yml', content: 'services: [' },
            { path: '.env', content: 'PG=17\n' },
          ],
        };
      },
    } as Pick<RepositoryContentsPort, 'topFiles'> as RepositoryContentsPort;

    const files = await new GitHubComposeFiles(contents).at(
      WorkspaceId.of('ws_1'),
      { repository: Repository.of('acme/api'), ref: 'fix/the-queue' },
    );

    expect(asked).toEqual([
      {
        names: [
          'compose.yaml',
          'compose.yml',
          'docker-compose.yaml',
          'docker-compose.yml',
          '.env',
        ],
        ref: 'fix/the-queue',
      },
    ]);
    expect(files.map(({ from, name }) => [from, name])).toEqual([
      ['api/compose.yaml', 'compose.yaml'],
      ['api/docker-compose.yml', 'docker-compose.yml'],
    ]);
    expect(files[0]?.services?.[0]).toMatchObject({
      name: 'db',
      image: 'postgres:17',
    });
    expect(files[1]?.services).toBeNull();
  });
});

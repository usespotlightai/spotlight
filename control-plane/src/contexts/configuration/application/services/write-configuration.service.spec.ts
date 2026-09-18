import { CONFIGURATION_BRANCH } from '@configuration/application/contracts/configuration-layout.contract';
import { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import type {
  PullRequestPort,
  PullRequestProposal,
} from '@github/application/ports/pull-request.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const INTO = {
  workspaceId: WorkspaceId.of('ws_1'),
  repository: Repository.of('acme/api'),
};

const WRITING = {
  title: 'Update Spotlight configuration',
  body: 'body',
  files: [
    ConfigurationFile.of('.spotlight/lines/delivery/line.yml', 'version: 1'),
  ],
};

const writing = () => {
  const proposed: PullRequestProposal[] = [];
  const pullRequests = {
    propose: async (proposal: PullRequestProposal) => {
      proposed.push(proposal);
      return { url: 'https://github.com/acme/api/pull/1' };
    },
  } as unknown as PullRequestPort;

  return { service: new WriteConfiguration(pullRequests), proposed };
};

describe('WriteConfiguration', () => {
  it('proposes the change on the configuration branch of the repository it is handed', async () => {
    const { service, proposed } = writing();

    await expect(service.writeInto(INTO, WRITING)).resolves.toEqual({
      url: 'https://github.com/acme/api/pull/1',
    });
    expect(proposed).toEqual([
      {
        workspaceId: INTO.workspaceId,
        repository: INTO.repository,
        branch: CONFIGURATION_BRANCH,
        title: WRITING.title,
        body: WRITING.body,
        message: WRITING.title,
        files: [
          { path: '.spotlight/lines/delivery/line.yml', text: 'version: 1' },
        ],
        removes: [],
      },
    ]);
  });

  it('takes away what the change removes, in the same proposal', async () => {
    const { service, proposed } = writing();

    await service.writeInto(INTO, {
      ...WRITING,
      files: [],
      removes: ['.spotlight/integrations/linear.yml'],
    });

    expect(proposed[0]?.files).toEqual([]);
    expect(proposed[0]?.removes).toEqual([
      '.spotlight/integrations/linear.yml',
    ]);
  });
});

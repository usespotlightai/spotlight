import type { PullRequestPort } from '@application/ports/pull-request.port';
import type { ConfigurationTarget } from '@application/services/configuration-target.service';
import { WriteConfiguration } from '@application/services/write-configuration.service';
import type { Team } from '@domain/aggregates/team.aggregate';
import { CONFIGURATION_BRANCH } from '@domain/aggregates/team-configuration.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { describe, expect, it, vi } from 'vitest';

const TARGET = {
  installation: GitHubInstallation.of('42'),
  repository: Repository.of('acme/api'),
};

const WRITING = {
  branch: CONFIGURATION_BRANCH,
  title: 'Update Spotlight configuration',
  body: 'body',
  files: [ConfigurationFile.of('.spotlight/lines/delivery.yml', 'version: 1')],
};

const writing = (target: typeof TARGET | null = TARGET) => {
  const of = vi.fn(async () => target);
  const propose = vi.fn(async () => ({
    url: 'https://github.com/acme/api/pull/1',
  }));

  return {
    of,
    propose,
    service: new WriteConfiguration(
      { of } as unknown as ConfigurationTarget,
      { propose, open: vi.fn() } as unknown as PullRequestPort,
    ),
  };
};

const WORKSPACE = {} as Workspace;
const TEAM = {} as Team;

describe('WriteConfiguration', () => {
  it('writes into the repository the team’s changes go to', async () => {
    const { service, propose } = writing();

    expect(await service.write(WORKSPACE, TEAM, WRITING)).toEqual({
      url: 'https://github.com/acme/api/pull/1',
    });

    const [proposal] = propose.mock.calls[0] as never as [
      { repository: Repository; files: { path: string }[] },
    ];
    expect(proposal.repository).toEqual(TARGET.repository);
    expect(proposal.files.map((each) => each.path)).toEqual([
      '.spotlight/lines/delivery.yml',
    ]);
  });

  it('writes nothing, and looks nowhere, where there is nothing to write', async () => {
    const { service, of, propose } = writing();

    expect(
      await service.write(WORKSPACE, TEAM, { ...WRITING, files: [] }),
    ).toBeNull();
    expect(of).not.toHaveBeenCalled();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes nothing where there is nowhere to write it yet', async () => {
    const { service, propose } = writing(null);

    expect(await service.write(WORKSPACE, TEAM, WRITING)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes into a repository it is handed, without asking the team', async () => {
    const { service, of, propose } = writing();
    const elsewhere = { ...TARGET, repository: Repository.of('acme/new') };

    await service.writeInto(elsewhere, WRITING);

    expect(of).not.toHaveBeenCalled();
    const [proposal] = propose.mock.calls[0] as never as [
      { repository: Repository; message: string; removes: string[] },
    ];
    expect(proposal.repository.value).toBe('acme/new');
    expect(proposal.message).toBe(WRITING.title);
    expect(proposal.removes).toEqual([]);
  });
});

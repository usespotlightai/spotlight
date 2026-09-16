import type { PullRequestPort } from '@application/ports/pull-request.port';
import type {
  Reading,
  RepositoryContentsPort,
} from '@application/ports/repository-contents.port';
import { PendingConfiguration } from '@application/services/pending-configuration.service';
import { CONFIGURATION_BRANCH } from '@domain/aggregates/team-configuration.aggregate';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const INTO = {
  installation: GitHubInstallation.of('42'),
  repository: Repository.of('acme/api'),
};

const PATH = '.spotlight/lines/default/line.yml';

const pending = (
  over: {
    open?: boolean;
    head?: string | null;
    refs?: Record<string, string>;
  } = {},
) => {
  const refs = over.refs ?? {
    [CONFIGURATION_BRANCH]: 'on the branch',
    a1b2c3d: 'at the head',
  };
  const contents = {
    headOf: async () => (over.head === undefined ? 'a1b2c3d' : over.head),
    read: async (reading: Reading) => {
      const text = refs[reading.ref];
      return text === undefined ? null : { path: reading.path, text };
    },
    under: async (reading: Reading) => {
      const text = refs[reading.ref];
      return text === undefined
        ? []
        : [{ path: `${reading.path}/delivery/line.yml`, text }];
    },
  } satisfies RepositoryContentsPort;
  const pullRequests = {
    openFor: async (
      _installation: GitHubInstallation,
      _repository: Repository,
      branch: string,
    ) =>
      over.open !== false && branch === CONFIGURATION_BRANCH
        ? { url: 'https://github.com/acme/api/pull/9' }
        : null,
  } as unknown as PullRequestPort;

  return new PendingConfiguration(contents, pullRequests);
};

describe('PendingConfiguration', () => {
  describe('on the branch', () => {
    it('reads the file as the open pull request has it', async () => {
      await expect(pending().onBranch(INTO, PATH)).resolves.toEqual(
        ConfigurationFile.of(PATH, 'on the branch'),
      );
    });

    it('reads nothing where no pull request is open, however the branch stands', async () => {
      await expect(
        pending({ open: false }).onBranch(INTO, PATH),
      ).resolves.toBeNull();
    });

    it('reads nothing where the branch holds no such file', async () => {
      await expect(
        pending({ refs: { a1b2c3d: 'at the head' } }).onBranch(INTO, PATH),
      ).resolves.toBeNull();
    });
  });

  describe('the file as it stands', () => {
    it('is the branch’s copy while a pull request is open', async () => {
      await expect(pending().fileAt(INTO, PATH)).resolves.toEqual(
        ConfigurationFile.of(PATH, 'on the branch'),
      );
    });

    it('is the live head’s copy where no pull request is open', async () => {
      await expect(
        pending({ open: false }).fileAt(INTO, PATH),
      ).resolves.toEqual(ConfigurationFile.of(PATH, 'at the head'));
    });

    it('is the live head’s copy where the open pull request does not touch it', async () => {
      await expect(
        pending({ refs: { a1b2c3d: 'at the head' } }).fileAt(INTO, PATH),
      ).resolves.toEqual(ConfigurationFile.of(PATH, 'at the head'));
    });

    it('is nothing where the repository has no head yet', async () => {
      await expect(
        pending({ open: false, head: null }).fileAt(INTO, PATH),
      ).resolves.toBeNull();
    });

    it('is nothing where neither holds the file', async () => {
      await expect(
        pending({ refs: {} }).fileAt(INTO, PATH),
      ).resolves.toBeNull();
    });
  });

  describe('the files under a folder', () => {
    const LINES = '.spotlight/lines';

    it('are the branch’s, whole, while a pull request is open', async () => {
      await expect(pending().under(INTO, LINES)).resolves.toEqual({
        onBranch: true,
        files: [
          ConfigurationFile.of(`${LINES}/delivery/line.yml`, 'on the branch'),
        ],
      });
    });

    it('are the live head’s where no pull request is open', async () => {
      await expect(
        pending({ open: false }).under(INTO, LINES),
      ).resolves.toEqual({
        onBranch: false,
        files: [
          ConfigurationFile.of(`${LINES}/delivery/line.yml`, 'at the head'),
        ],
      });
    });

    it('are none where the repository has no head yet', async () => {
      await expect(
        pending({ open: false, head: null }).under(INTO, LINES),
      ).resolves.toEqual({ onBranch: false, files: [] });
    });
  });
});

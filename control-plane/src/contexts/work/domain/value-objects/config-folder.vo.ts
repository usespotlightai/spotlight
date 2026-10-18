import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { InvalidConfigFolderError } from '@work/domain/exceptions/invalid-config-folder.error';

const LONGEST_FOLDER = 200;

const SEGMENT = /^[A-Za-z0-9._-]+$/;

const folderProblem = (folder: string): string | null => {
  if (folder.length === 0 || folder.length > LONGEST_FOLDER) {
    return `must be 1 to ${LONGEST_FOLDER} characters`;
  }

  const segments = folder.split('/');

  if (segments.some((each) => each === '.' || each === '..')) {
    return 'must not contain . or .. parts';
  }

  return segments.every((each) => SEGMENT.test(each))
    ? null
    : 'must be a path from the repository root with forward slashes, as in spotlight or infra/spotlight';
};

export class ConfigFolder {
  private constructor(
    readonly repository: Repository,
    readonly folder: string,
    readonly pullRequest: PullRequestUrl | null,
  ) {}

  static of(input: { repository: string; folder: string }): ConfigFolder {
    let repository: Repository;

    try {
      repository = Repository.of(input.repository);
    } catch (error) {
      if (error instanceof InvalidRepositoryError) {
        throw new InvalidConfigFolderError(
          'repository',
          `must be a GitHub repository as owner/name, not ${input.repository}`,
        );
      }
      throw error;
    }

    const folder = input.folder.trim().replace(/^\/+|\/+$/g, '');
    const problem = folderProblem(folder);

    if (problem) {
      throw new InvalidConfigFolderError('folder', problem);
    }

    return new ConfigFolder(repository, folder, null);
  }

  static rehydrate(input: {
    repository: Repository;
    folder: string;
    pullRequest: PullRequestUrl | null;
  }): ConfigFolder {
    return new ConfigFolder(input.repository, input.folder, input.pullRequest);
  }

  opened(pullRequest: PullRequestUrl): ConfigFolder {
    return new ConfigFolder(this.repository, this.folder, pullRequest);
  }

  equals(other: ConfigFolder): boolean {
    return (
      this.repository.equals(other.repository) &&
      this.folder === other.folder &&
      (this.pullRequest?.value ?? null) === (other.pullRequest?.value ?? null)
    );
  }
}

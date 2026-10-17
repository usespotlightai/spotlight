import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { InvalidConfigSourceError } from '@work/domain/exceptions/invalid-config-source.error';

const LONGEST_PATH = 1_024;

const TERRAFORM_FILE = /\.tf$/;

const pathProblem = (path: string): string | null => {
  if (path.length === 0 || path.length > LONGEST_PATH) {
    return `must be 1 to ${LONGEST_PATH.toLocaleString('en-US')} characters`;
  }
  if (path.startsWith('/') || path.includes('\\')) {
    return 'must be a path from the repository root with forward slashes, as in teams/core/delivery.tf';
  }

  const segments = path.split('/');

  if (segments.some((each) => each === '' || each === '.' || each === '..')) {
    return 'must not contain empty, . or .. parts';
  }

  return TERRAFORM_FILE.test(path) ? null : 'must end in .tf';
};

export class ConfigSource {
  private constructor(
    readonly repository: Repository,
    readonly path: string,
  ) {}

  static of(input: { repository: string; path: string }): ConfigSource {
    let repository: Repository;

    try {
      repository = Repository.of(input.repository);
    } catch (error) {
      if (error instanceof InvalidRepositoryError) {
        throw new InvalidConfigSourceError(
          'repository',
          `must be a GitHub repository as owner/name, not ${input.repository}`,
        );
      }
      throw error;
    }

    const problem = pathProblem(input.path);

    if (problem) {
      throw new InvalidConfigSourceError('path', problem);
    }

    return new ConfigSource(repository, input.path);
  }

  equals(other: ConfigSource): boolean {
    return this.repository.equals(other.repository) && this.path === other.path;
  }
}

import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { InvalidConfigSourceError } from '@work/domain/exceptions/invalid-config-source.error';

const LONGEST_PATH = 1_024;

const TERRAFORM_FILE = /\.tf$/;

const pathRefusal = (path: string): string | null => {
  if (path.length === 0 || path.length > LONGEST_PATH) {
    return `is the Terraform file that holds the line, of 1 to ${LONGEST_PATH.toLocaleString('en-US')} characters`;
  }
  if (path.startsWith('/') || path.includes('\\')) {
    return 'is a path from the root of the repository, with forward slashes and no leading slash, as in teams/core/delivery.tf';
  }

  const segments = path.split('/');

  if (segments.some((each) => each === '' || each === '.' || each === '..')) {
    return 'names each directory on the way to the file, with no empty, . or .. parts';
  }

  return TERRAFORM_FILE.test(path)
    ? null
    : 'is a Terraform file, ending in .tf';
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
          `is the GitHub repository that holds the line’s Terraform, as owner/name: ${error.message}`,
        );
      }
      throw error;
    }

    const refused = pathRefusal(input.path);

    if (refused) {
      throw new InvalidConfigSourceError('path', refused);
    }

    return new ConfigSource(repository, input.path);
  }

  equals(other: ConfigSource): boolean {
    return this.repository.equals(other.repository) && this.path === other.path;
  }
}

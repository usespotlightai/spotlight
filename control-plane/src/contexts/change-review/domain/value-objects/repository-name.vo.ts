import { InvalidRepositoryNameError } from '@change-review/domain/exceptions/invalid-repository-name.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const MAX_LENGTH = 100;

export class RepositoryName {
  private constructor(readonly value: string) {}

  static of(raw: string): RepositoryName {
    const name = raw.trim();

    if (!name || name.length > MAX_LENGTH) {
      throw new InvalidRepositoryNameError(
        `must not be empty and must be at most ${MAX_LENGTH} characters`,
      );
    }

    if (name.includes('/') || name.includes('\\') || name.startsWith('.')) {
      throw new InvalidRepositoryNameError(
        `${name} is not a repository of the workspace`,
      );
    }

    return new RepositoryName(name);
  }

  static optional(raw: string | null | undefined): RepositoryName | null {
    return raw?.trim() ? RepositoryName.of(raw) : null;
  }

  static ofPullRequest(pullRequest: PullRequestUrl): RepositoryName | null {
    const repository = pullRequest.repository;

    if (!repository) {
      return null;
    }

    try {
      return RepositoryName.of(repository.name);
    } catch {
      return null;
    }
  }

  names(repository: Repository): boolean {
    return this.value.toLowerCase() === repository.name.toLowerCase();
  }

  isOf(pullRequest: PullRequestUrl): boolean {
    const repository = pullRequest.repository;

    return repository !== null && this.names(repository);
  }

  equals(other: RepositoryName): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase();
  }
}

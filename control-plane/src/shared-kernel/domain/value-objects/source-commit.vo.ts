import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const SHAPE = /^([^@\s]+)@([0-9a-f]{40}|[0-9a-f]{64})$/;

const SHORT = 7;

export class SourceCommit {
  private constructor(
    readonly repository: Repository,
    readonly sha: string,
  ) {}

  static of(input: { repository: string; sha: string }): SourceCommit {
    return new SourceCommit(
      Repository.of(input.repository),
      input.sha.toLowerCase(),
    );
  }

  static named(header: string | undefined): SourceCommit | null {
    const found = SHAPE.exec(header?.trim().toLowerCase() ?? '');

    if (!found) {
      return null;
    }

    try {
      return SourceCommit.of({
        repository: found[1],
        sha: found[2],
      });
    } catch (error) {
      if (error instanceof InvalidRepositoryError) {
        return null;
      }
      throw error;
    }
  }

  get shortSha(): string {
    return this.sha.slice(0, SHORT);
  }

  get url(): string {
    return `${this.repository.url}/commit/${this.sha}`;
  }

  toString(): string {
    return `${this.repository.value}@${this.sha}`;
  }
}

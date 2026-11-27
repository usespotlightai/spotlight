import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

// Where the team's configuration as code defines the line: the Terraform file and the repository it is in. Lines checks the path; Work only reads it.
export class LineSource {
  private constructor(
    readonly repository: Repository,
    readonly path: string,
  ) {}

  static of(input: { repository: Repository; path: string }): LineSource {
    if (input.path.trim() === '') {
      throw new InconsistentStateError('line source', 'names no file');
    }

    return new LineSource(input.repository, input.path);
  }
}

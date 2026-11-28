import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

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

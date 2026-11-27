import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

// Where the team's configuration as code defines the line: the Terraform file and the repository it is in.
export class LineSource {
  private constructor(
    readonly repository: Repository,
    readonly path: string,
  ) {}

  static of(input: { repository: Repository; path: string }): LineSource {
    return new LineSource(input.repository, input.path);
  }
}

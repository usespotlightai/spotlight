import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import type { LineSource } from '@work/domain/value-objects/line-source.vo';

export class RepositoriesMissing {
  readonly code = 'line_has_no_repositories';

  private constructor(
    readonly line: LineName,
    readonly source: LineSource | null,
  ) {}

  static of(line: {
    readonly name: LineName;
    readonly source: LineSource | null;
  }): RepositoriesMissing {
    return new RepositoriesMissing(line.name, line.source);
  }
}

import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import type { LineSource } from '@work/domain/value-objects/line-source.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';

const BLOCK = 'Add a `repository` block to the line’s `spotlight_line`';

export class RepositoriesMissing implements RefusalReason {
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

  get description(): string {
    const missing = `The ${this.line.value} line has no repository yet.`;

    return this.source
      ? `${missing} ${BLOCK} in \`${this.source.path}\` in ${this.source.repository.value}.`
      : `${missing} ${BLOCK} in your team’s configuration. If the team has no configuration as code yet, start with “Set up configuration as code” on the setup checklist.`;
  }
}

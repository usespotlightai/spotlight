import { Happening } from '@domain/value-objects/happening.vo';
import type { SourceKey } from '@domain/value-objects/source-key.vo';

/**
 * What choosing a source installs on a line: words it opens a task for, filed
 * at the backlog, and words it moves a standing task on, to a named station.
 */
export interface SourceContribution {
  readonly opens: readonly Happening[];
  readonly moves: readonly {
    readonly happening: Happening;
    readonly to: string;
  }[];
}

const NONE: SourceContribution = { opens: [], moves: [] };

const BY_SOURCE: Readonly<Record<string, SourceContribution>> = {
  // A new issue filed elsewhere has no task yet: open one.
  linear: {
    opens: [Happening.of('linear.issue.created')],
    moves: [],
  },
};

export const contributionOf = (source: SourceKey): SourceContribution =>
  BY_SOURCE[source.value] ?? NONE;

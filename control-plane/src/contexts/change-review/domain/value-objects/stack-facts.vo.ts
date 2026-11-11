import type {
  DiffFacts,
  FileClass,
  FileImport,
  HunkFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

export class StackFacts implements DiffFacts {
  private constructor(
    readonly hunks: readonly HunkFacts[],
    readonly links: readonly HunkLink[],
    readonly imports: readonly FileImport[],
  ) {}

  static of(facts: DiffFacts): StackFacts {
    return new StackFacts(facts.hunks, facts.links, facts.imports);
  }

  classOf(hunk: HunkId): FileClass | null {
    return this.hunks.find((each) => each.hunk === hunk)?.fileClass ?? null;
  }

  isGenerated(hunk: HunkId): boolean {
    return this.classOf(hunk) === 'generated';
  }
}

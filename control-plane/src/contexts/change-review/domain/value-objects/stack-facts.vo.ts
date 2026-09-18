import type {
  DiffFacts,
  FileClass,
  FileImport,
  HunkFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';

export class StackFacts implements DiffFacts {
  private constructor(
    readonly hunks: readonly HunkFacts[],
    readonly links: readonly HunkLink[],
    readonly imports: readonly FileImport[],
  ) {}

  static of(facts: DiffFacts): StackFacts {
    return new StackFacts(facts.hunks, facts.links, facts.imports);
  }

  static none(): StackFacts {
    return new StackFacts([], [], []);
  }

  classOf(hunk: string): FileClass | null {
    return this.hunks.find((each) => each.hunk === hunk)?.fileClass ?? null;
  }

  isGenerated(hunk: string): boolean {
    return this.classOf(hunk) === 'generated';
  }
}

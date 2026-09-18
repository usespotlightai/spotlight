import type { StackProblem } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import type { StackRevision } from '@change-review/domain/services/stack-revision';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';

export const CHANGE_STACK_DRAFTER = Symbol('CHANGE_STACK_DRAFTER');

export interface ChangeStackDraft {
  readonly diff: Diff;
  readonly repository: RepositoryName | null;
  readonly facts: DiffFacts;
  readonly problems: readonly StackProblem[];
  readonly reordering?: StackRevision | null;
}

export interface ChangeStackDrafterPort {
  readonly available: boolean;

  draft(draft: ChangeStackDraft): Promise<readonly ProposedCohort[]>;
}

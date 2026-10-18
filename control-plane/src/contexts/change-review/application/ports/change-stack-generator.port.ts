import type { StackProblem } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import type { RedraftRequest } from '@change-review/domain/services/redraft-request';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const CHANGE_STACK_GENERATOR = Symbol('CHANGE_STACK_GENERATOR');

export interface ChangeStackGenerationRequest {
  readonly diff: Diff;
  readonly repository: RepositoryName | null;
  readonly facts: DiffFacts;
  readonly problems: readonly StackProblem[];
  readonly redraft?: RedraftRequest | null;
}

export interface GeneratedChangeStack {
  readonly cohorts: readonly ProposedCohort[];
  readonly usage: ModelCall | null;
}

export interface ChangeStackGeneratorPort {
  readonly available: boolean;

  generate(
    request: ChangeStackGenerationRequest,
  ): Promise<GeneratedChangeStack>;
}

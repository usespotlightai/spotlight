import type { SessionWaiting } from '@change-review/application/ports/session-waiting';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import type { PreviousStack } from '@change-review/domain/services/previous-stack';
import type { RedraftRequest } from '@change-review/domain/services/redraft-request';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import type { DraftedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { StackProblem } from '@change-review/domain/value-objects/stack-problem.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_STACK_GENERATOR = Symbol('CHANGE_STACK_GENERATOR');

export interface ChangeStackGenerationRequest {
  readonly workspaceId: string;
  /** Which session drafts it: the same round reports on that session, a new round drafts the stack again. */
  readonly round: DraftingRound;
  /** The run whose harness, model and working copy the session takes. */
  readonly basedOnRun: RunId;
  readonly diff: Diff;
  readonly repository: RepositoryName | null;
  readonly facts: DiffFacts;
  /** What the last draft of the stack broke, for the next draft to fix. */
  readonly problems: readonly StackProblem[];
  readonly redraft?: RedraftRequest | null;
  readonly previous?: PreviousStack | null;
}

export type GeneratedChangeStack =
  | {
      readonly status: 'drafted';
      readonly cohorts: readonly DraftedCohort[];
      readonly usage: ModelCall | null;
    }
  | { readonly status: 'failed'; readonly failure: SessionFailure }
  | SessionWaiting;

export interface ChangeStackGeneratorPort {
  /** Drafts the whole stack in one assist session; answers waiting while the session runs. */
  generate(
    request: ChangeStackGenerationRequest,
  ): Promise<GeneratedChangeStack>;
}

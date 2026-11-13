import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
  CohortLayersRequest,
} from '@change-review/application/ports/change-stack-generator.port';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { arranged } from '@change-review/domain/services/arrange-stack';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import { DraftedStack } from '@change-review/domain/services/drafted-stack';
import { StackOutline } from '@change-review/domain/services/stack-outline';
import { stackPartOf } from '@change-review/domain/services/stack-part';
import { StackProposal } from '@change-review/domain/services/stack-proposal';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type {
  DraftedCohort,
  DraftedLayer,
  DraftedOutline,
  OutlinedCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';

export type Draft =
  | { readonly kind: 'whole'; readonly cohorts: readonly DraftedCohort[] }
  | { readonly kind: 'outline'; readonly cohorts: readonly DraftedOutline[] }
  | {
      readonly kind: 'layers';
      readonly cohort: OutlinedCohort;
      readonly layers: readonly DraftedLayer[];
    };

export type CheckedDraft = Draft & { readonly problems: readonly string[] };

export const problemsOf = (
  diff: Diff,
  facts: DiffFacts,
  draft: Draft,
): string[] => {
  try {
    if (draft.kind === 'whole') {
      StackProposal.accepted({
        diff,
        facts,
        cohorts: arranged(diff, facts, DraftedStack.cohorts(draft.cohorts)),
      });
    } else if (draft.kind === 'outline') {
      StackOutline.validate({ diff, facts, cohorts: draft.cohorts });
    } else {
      StackOutline.layered(
        stackPartOf(diff, facts, draft.cohort.hunks),
        draft.cohort,
        draft.layers,
      );
    }
    return [];
  } catch (error) {
    if (error instanceof InvalidChangeStackError) {
      return error.problems.map((each) => each.message);
    }
    return [error instanceof Error ? error.message : String(error)];
  }
};

export class RecordingGenerator implements ChangeStackGeneratorPort {
  readonly drafts: CheckedDraft[] = [];

  constructor(private readonly generator: ChangeStackGeneratorPort) {}

  get available(): boolean {
    return this.generator.available;
  }

  async generate(request: ChangeStackGenerationRequest) {
    const answer = await this.generator.generate(request);
    this.kept(request.diff, request.facts, {
      kind: 'whole',
      cohorts: answer.cohorts,
    });
    return answer;
  }

  async outline(request: ChangeStackGenerationRequest) {
    const answer = await this.generator.outline(request);
    this.kept(request.diff, request.facts, {
      kind: 'outline',
      cohorts: answer.cohorts,
    });
    return answer;
  }

  async layers(request: CohortLayersRequest) {
    const answer = await this.generator.layers(request);
    this.kept(request.part.diff, request.part.facts, {
      kind: 'layers',
      cohort: request.cohort,
      layers: answer.layers,
    });
    return answer;
  }

  private kept(diff: Diff, facts: DiffFacts, draft: Draft): void {
    this.drafts.push({ ...draft, problems: problemsOf(diff, facts, draft) });
  }
}

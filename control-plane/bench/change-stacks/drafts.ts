import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
  CohortLayersRequest,
  LayerDetailsRequest,
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
  DraftedLayerDetails,
  DraftedLayerPlan,
  DraftedOutline,
  OutlinedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';

export type Draft =
  | { readonly kind: 'whole'; readonly cohorts: readonly DraftedCohort[] }
  | { readonly kind: 'outline'; readonly cohorts: readonly DraftedOutline[] }
  | {
      readonly kind: 'layers';
      readonly cohort: OutlinedCohort;
      readonly layers: readonly DraftedLayer[];
    }
  | {
      readonly kind: 'plan';
      readonly cohort: OutlinedCohort;
      readonly layers: readonly DraftedLayerPlan[];
    }
  | {
      readonly kind: 'details';
      readonly cohort: OutlinedCohort;
      readonly plan: readonly ProposedLayer[];
      readonly layer: number;
      readonly details: DraftedLayerDetails;
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
    } else if (draft.kind === 'layers') {
      StackOutline.layered(
        stackPartOf(diff, facts, draft.cohort.hunks),
        draft.cohort,
        draft.layers,
      );
    } else if (draft.kind === 'plan') {
      StackOutline.planned(
        stackPartOf(diff, facts, draft.cohort.hunks),
        draft.cohort,
        draft.layers,
      );
    } else {
      const { hunks: _, ...outlined } = draft.cohort;

      return StackOutline.detailProblems(
        stackPartOf(diff, facts, draft.cohort.hunks),
        { ...outlined, layers: draft.plan },
        draft.layer,
        draft.details,
      ).map((each) => each.message);
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

  async layerPlan(request: CohortLayersRequest) {
    const answer = await this.generator.layerPlan(request);
    this.kept(request.part.diff, request.part.facts, {
      kind: 'plan',
      cohort: request.cohort,
      layers: answer.layers,
    });
    return answer;
  }

  async layerDetails(request: LayerDetailsRequest) {
    const answer = await this.generator.layerDetails(request);
    this.kept(request.part.diff, request.part.facts, {
      kind: 'details',
      cohort: request.cohort,
      plan: request.plan,
      layer: request.layer,
      details: answer.details,
    });
    return answer;
  }

  private kept(diff: Diff, facts: DiffFacts, draft: Draft): void {
    this.drafts.push({ ...draft, problems: problemsOf(diff, facts, draft) });
  }
}

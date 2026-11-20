import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class WorkspacePlanChangeDetail implements ChangeDetail {
  private constructor(
    readonly plan: string,
    readonly expiresAt: string | null,
  ) {}

  static of(term: PlanTerm): WorkspacePlanChangeDetail {
    return new WorkspacePlanChangeDetail(
      term.plan.value,
      term.expiresAt?.toISOString() ?? null,
    );
  }

  recorded(): RecordedDetail {
    return { plan: this.plan, expiresAt: this.expiresAt };
  }
}

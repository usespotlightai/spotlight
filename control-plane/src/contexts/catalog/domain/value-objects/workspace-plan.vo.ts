import { Plan } from '@catalog/domain/value-objects/plan.vo';

export class WorkspacePlan {
  private constructor(
    readonly plan: Plan,
    readonly lapsesAt: Date | null,
  ) {}

  static readonly free = new WorkspacePlan(Plan.free, null);

  static of(plan: Plan, lapsesAt: Date | null = null): WorkspacePlan {
    return new WorkspacePlan(plan, lapsesAt);
  }

  lapsedBy(now: Date): boolean {
    return this.lapsesAt !== null && this.lapsesAt.getTime() <= now.getTime();
  }

  at(now: Date): Plan {
    return this.lapsedBy(now) ? Plan.free : this.plan;
  }
}

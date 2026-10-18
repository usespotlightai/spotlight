import { Plan } from '@catalog/domain/value-objects/plan.vo';

export class WorkspacePlan {
  private constructor(
    readonly plan: Plan,
    readonly expiresAt: Date | null,
  ) {}

  static readonly free = new WorkspacePlan(Plan.free, null);

  static of(plan: Plan, expiresAt: Date | null = null): WorkspacePlan {
    return new WorkspacePlan(plan, expiresAt);
  }

  isExpiredAt(now: Date): boolean {
    return this.expiresAt !== null && this.expiresAt.getTime() <= now.getTime();
  }

  at(now: Date): Plan {
    return this.isExpiredAt(now) ? Plan.free : this.plan;
  }
}

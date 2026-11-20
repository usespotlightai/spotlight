import { Plan } from '@catalog/domain/value-objects/plan.vo';

export class PlanTerm {
  private constructor(
    readonly plan: Plan,
    readonly expiresAt: Date | null,
  ) {}

  static readonly free = new PlanTerm(Plan.free, null);

  static of(plan: Plan, expiresAt: Date | null = null): PlanTerm {
    return new PlanTerm(plan, expiresAt);
  }

  get isDefault(): boolean {
    return this.equals(PlanTerm.free);
  }

  isExpiredAt(now: Date): boolean {
    return this.expiresAt !== null && this.expiresAt.getTime() <= now.getTime();
  }

  at(now: Date): Plan {
    return this.isExpiredAt(now) ? Plan.free : this.plan;
  }

  equals(other: PlanTerm): boolean {
    return (
      this.plan.equals(other.plan) &&
      (this.expiresAt?.getTime() ?? null) ===
        (other.expiresAt?.getTime() ?? null)
    );
  }
}

import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const PLANS = ['free', 'team', 'enterprise'] as const;

type PlanName = (typeof PLANS)[number];

export class Plan {
  private constructor(readonly value: PlanName) {}

  static readonly free = new Plan('free');

  static readonly team = new Plan('team');

  static readonly enterprise = new Plan('enterprise');

  static of(raw: string): Plan {
    const named = PLANS.find((each) => each === raw);

    if (!named) {
      throw new InconsistentStateError('plan', `names no plan (${raw})`);
    }

    return new Plan(named);
  }

  includes(other: Plan): boolean {
    return PLANS.indexOf(this.value) >= PLANS.indexOf(other.value);
  }

  get title(): string {
    return this.value.charAt(0).toUpperCase() + this.value.slice(1);
  }

  equals(other: Plan): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

import type { PlanTermDto } from '@catalog/application/dto/plan-term.dto';
import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';

export const PlanTermMapper = {
  toDto: (term: PlanTerm): PlanTermDto => ({
    plan: term.plan.value,
    expiresAt: term.expiresAt?.toISOString() ?? null,
  }),
};

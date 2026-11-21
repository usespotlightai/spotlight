import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { workspacePlan } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';

type PlanTermRow = Pick<typeof workspacePlan.$inferSelect, 'plan' | 'expiresAt'>;

export const termOf = (row: PlanTermRow): PlanTerm =>
  PlanTerm.of(Plan.rehydrate(row.plan), row.expiresAt);

import type { CatalogItem } from '@catalog/domain/entities/catalog-item.entity';
import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';

export type Entitlement =
  | { readonly entitled: true }
  | {
      readonly entitled: false;
      readonly reason: 'not-entitled' | 'expired';
      readonly because: string;
    };

export const entitlementTo = (
  item: CatalogItem,
  plan: PlanTerm,
  now: Date,
): Entitlement => {
  const requiredPlan = item.metadata.requiredPlan;
  const on = plan.at(now);

  if (on.includes(requiredPlan)) {
    return { entitled: true };
  }

  return plan.isExpiredAt(now) && plan.plan.includes(requiredPlan)
    ? {
        entitled: false,
        reason: 'expired',
        because: `Catalog item ${item.id.value} requires the ${requiredPlan.title} plan. The workspace’s ${plan.plan.title} plan has expired. Expired at: ${plan.expiresAt?.toISOString()}`,
      }
    : {
        entitled: false,
        reason: 'not-entitled',
        because: `Catalog item ${item.id.value} requires the ${requiredPlan.title} plan. Workspace plan: ${on.title}`,
      };
};

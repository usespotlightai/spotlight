import type { CatalogItem } from '@catalog/domain/entities/catalog-item.entity';
import type { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';

export type Entitlement =
  | { readonly entitled: true }
  | {
      readonly entitled: false;
      readonly reason: 'not-entitled' | 'lapsed';
      readonly because: string;
    };

export const entitlementTo = (
  item: CatalogItem,
  plan: WorkspacePlan,
  now: Date,
): Entitlement => {
  const needs = item.listing.needs;
  const on = plan.at(now);

  if (on.includes(needs)) {
    return { entitled: true };
  }

  return plan.lapsedBy(now) && plan.plan.includes(needs)
    ? {
        entitled: false,
        reason: 'lapsed',
        because: `${item.id.value} needs the ${needs.title} plan. The workspace’s ${plan.plan.title} plan has lapsed. Lapsed at: ${plan.lapsesAt?.toISOString()}`,
      }
    : {
        entitled: false,
        reason: 'not-entitled',
        because: `${item.id.value} needs the ${needs.title} plan. Workspace plan: ${on.title}`,
      };
};

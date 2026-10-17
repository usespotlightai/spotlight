import type {
  CatalogItem,
  CatalogKind,
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogRepository } from '@catalog/domain/repositories/catalog.repository';
import { entitlementTo } from '@catalog/domain/services/entitlement';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import type { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';

type DenialReason = 'unknown' | 'wrong-kind' | 'not-entitled' | 'lapsed';

export interface Denial {
  readonly id: string;
  readonly reason: DenialReason;
  readonly detail: string;
}

interface Given<T extends CatalogItem> {
  readonly given: true;
  readonly item: T;
}

interface Denied {
  readonly given: false;
  readonly denial: Denial;
}

export type Giving<T extends CatalogItem> = Given<T> | Denied;

export interface Named {
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface Givings {
  readonly tools: readonly CatalogTool[];
  readonly skills: readonly CatalogSkill[];
  readonly denied: readonly Denial[];
}

type ItemOf<K extends CatalogKind> = K extends 'tool'
  ? CatalogTool
  : CatalogSkill;

const denied = (id: string, reason: DenialReason, detail: string): Denied => ({
  given: false,
  denial: { id, reason, detail },
});

export const givingOfItem = <T extends CatalogItem>(
  item: T,
  plan: WorkspacePlan,
  now: Date,
): Giving<T> => {
  const entitlement = entitlementTo(item, plan, now);

  return entitlement.entitled
    ? { given: true, item }
    : denied(item.id.value, entitlement.reason, entitlement.because);
};

export const givingOf = <K extends CatalogKind>(
  id: string,
  kind: K,
  catalog: CatalogRepository,
  plan: WorkspacePlan,
  now: Date,
): Giving<ItemOf<K>> => {
  let parsed: CatalogItemId;

  try {
    parsed = CatalogItemId.parse(id);
  } catch {
    return denied(id, 'unknown', `Catalog has no item ${id}.`);
  }

  const item = catalog.find(parsed);

  if (!item) {
    return denied(id, 'unknown', `Catalog has no item ${id}.`);
  }

  if (item.kind !== kind) {
    return denied(
      id,
      'wrong-kind',
      `Catalog item ${id} is a ${item.kind}, not a ${kind}.`,
    );
  }

  const giving = givingOfItem(item as ItemOf<K>, plan, now);

  return giving.given
    ? giving
    : denied(id, giving.denial.reason, giving.denial.detail);
};

export const givingsTo = (
  named: Named,
  catalog: CatalogRepository,
  plan: WorkspacePlan,
  now: Date,
): Givings => {
  const tools: CatalogTool[] = [];
  const skills: CatalogSkill[] = [];
  const denials: Denial[] = [];
  const seen = new Set<string>();

  const firstSight = (id: string): boolean => {
    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  };

  const giveTool = (id: string): void => {
    if (!firstSight(id)) {
      return;
    }

    const giving = givingOf(id, 'tool', catalog, plan, now);

    if (giving.given) {
      tools.push(giving.item);
    } else {
      denials.push(giving.denial);
    }
  };

  const giveSkill = (id: string): void => {
    if (!firstSight(id)) {
      return;
    }

    const giving = givingOf(id, 'skill', catalog, plan, now);

    if (!giving.given) {
      denials.push(giving.denial);
      return;
    }

    skills.push(giving.item);

    for (const each of giving.item.brings) {
      giveTool(each.value);
    }
  };

  for (const each of named.tools) {
    giveTool(each);
  }

  for (const each of named.skills) {
    giveSkill(each);
  }

  return { tools, skills, denied: denials };
};

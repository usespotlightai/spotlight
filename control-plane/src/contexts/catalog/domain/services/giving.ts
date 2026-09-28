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

type RefusalReason = 'unknown' | 'wrong-kind' | 'not-entitled' | 'lapsed';

interface Refusal {
  readonly id: string;
  readonly reason: RefusalReason;
  readonly because: string;
}

interface Given<T extends CatalogItem> {
  readonly given: true;
  readonly item: T;
}

interface Refused {
  readonly given: false;
  readonly refusal: Refusal;
}

export type Giving<T extends CatalogItem> = Given<T> | Refused;

export interface Named {
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface Givings {
  readonly tools: readonly CatalogTool[];
  readonly skills: readonly CatalogSkill[];
  readonly refused: readonly Refusal[];
}

type ItemOf<K extends CatalogKind> = K extends 'tool'
  ? CatalogTool
  : CatalogSkill;

const refused = (
  id: string,
  reason: RefusalReason,
  because: string,
): Refused => ({ given: false, refusal: { id, reason, because } });

export const givingOfItem = <T extends CatalogItem>(
  item: T,
  plan: WorkspacePlan,
  now: Date,
): Giving<T> => {
  const entitlement = entitlementTo(item, plan, now);

  return entitlement.entitled
    ? { given: true, item }
    : refused(item.id.value, entitlement.reason, entitlement.because);
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
    return refused(id, 'unknown', `${id} is not in the catalog`);
  }

  const item = catalog.find(parsed);

  if (!item) {
    return refused(id, 'unknown', `${id} is not in the catalog`);
  }

  if (item.kind !== kind) {
    return refused(
      id,
      'wrong-kind',
      `${id} is a catalog ${item.kind}, not a ${kind}`,
    );
  }

  const giving = givingOfItem(item as ItemOf<K>, plan, now);

  return giving.given
    ? giving
    : refused(id, giving.refusal.reason, giving.refusal.because);
};

export const givingsTo = (
  named: Named,
  catalog: CatalogRepository,
  plan: WorkspacePlan,
  now: Date,
): Givings => {
  const tools: CatalogTool[] = [];
  const skills: CatalogSkill[] = [];
  const refusals: Refusal[] = [];
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
      refusals.push(giving.refusal);
    }
  };

  const giveSkill = (id: string): void => {
    if (!firstSight(id)) {
      return;
    }

    const giving = givingOf(id, 'skill', catalog, plan, now);

    if (!giving.given) {
      refusals.push(giving.refusal);
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

  return { tools, skills, refused: refusals };
};

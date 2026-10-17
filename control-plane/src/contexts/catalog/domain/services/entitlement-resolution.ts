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

interface Entitled<T extends CatalogItem> {
  readonly entitled: true;
  readonly item: T;
}

interface Denied {
  readonly entitled: false;
  readonly denial: Denial;
}

export type EntitlementResult<T extends CatalogItem> = Entitled<T> | Denied;

export interface Named {
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface EntitledItems {
  readonly tools: readonly CatalogTool[];
  readonly skills: readonly CatalogSkill[];
  readonly denied: readonly Denial[];
}

type ItemOf<K extends CatalogKind> = K extends 'tool'
  ? CatalogTool
  : CatalogSkill;

const denied = (id: string, reason: DenialReason, detail: string): Denied => ({
  entitled: false,
  denial: { id, reason, detail },
});

export const resolveEntitledItem = <T extends CatalogItem>(
  item: T,
  plan: WorkspacePlan,
  now: Date,
): EntitlementResult<T> => {
  const entitlement = entitlementTo(item, plan, now);

  return entitlement.entitled
    ? { entitled: true, item }
    : denied(item.id.value, entitlement.reason, entitlement.because);
};

export const resolveEntitled = <K extends CatalogKind>(
  id: string,
  kind: K,
  catalog: CatalogRepository,
  plan: WorkspacePlan,
  now: Date,
): EntitlementResult<ItemOf<K>> => {
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

  const result = resolveEntitledItem(item as ItemOf<K>, plan, now);

  return result.entitled
    ? result
    : denied(id, result.denial.reason, result.denial.detail);
};

export const resolveEntitledFor = (
  named: Named,
  catalog: CatalogRepository,
  plan: WorkspacePlan,
  now: Date,
): EntitledItems => {
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

  const resolveTool = (id: string): void => {
    if (!firstSight(id)) {
      return;
    }

    const result = resolveEntitled(id, 'tool', catalog, plan, now);

    if (result.entitled) {
      tools.push(result.item);
    } else {
      denials.push(result.denial);
    }
  };

  const resolveSkill = (id: string): void => {
    if (!firstSight(id)) {
      return;
    }

    const result = resolveEntitled(id, 'skill', catalog, plan, now);

    if (!result.entitled) {
      denials.push(result.denial);
      return;
    }

    skills.push(result.item);

    for (const each of result.item.brings) {
      resolveTool(each.value);
    }
  };

  for (const each of named.tools) {
    resolveTool(each);
  }

  for (const each of named.skills) {
    resolveSkill(each);
  }

  return { tools, skills, denied: denials };
};

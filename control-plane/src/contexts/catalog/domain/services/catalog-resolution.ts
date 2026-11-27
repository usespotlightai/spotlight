import type {
  CatalogItem,
  CatalogKind,
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogItems } from '@catalog/domain/repositories/catalog-items.repository';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';

type DenialReason = 'unknown' | 'wrong-kind';

export interface Denial {
  readonly id: string;
  readonly reason: DenialReason;
  readonly detail: string;
}

interface Resolved<T extends CatalogItem> {
  readonly resolved: true;
  readonly item: T;
}

interface Denied {
  readonly resolved: false;
  readonly denial: Denial;
}

type ItemResolution<T extends CatalogItem> = Resolved<T> | Denied;

interface ItemRequest {
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface ResolvedItems {
  readonly tools: readonly CatalogTool[];
  readonly skills: readonly CatalogSkill[];
  readonly denied: readonly Denial[];
}

type ItemOf<K extends CatalogKind> = K extends 'tool'
  ? CatalogTool
  : CatalogSkill;

const isOfKind = <K extends CatalogKind>(
  item: CatalogItem,
  kind: K,
): item is ItemOf<K> => item.kind === kind;

const denied = (id: string, reason: DenialReason, detail: string): Denied => ({
  resolved: false,
  denial: { id, reason, detail },
});

export const resolveItem = <K extends CatalogKind>(
  id: string,
  kind: K,
  catalog: CatalogItems,
): ItemResolution<ItemOf<K>> => {
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

  if (!isOfKind(item, kind)) {
    return denied(
      id,
      'wrong-kind',
      `Catalog item ${id} is a ${item.kind}, not a ${kind}.`,
    );
  }

  return { resolved: true, item };
};

export const resolveItems = (
  request: ItemRequest,
  catalog: CatalogItems,
): ResolvedItems => {
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

    const result = resolveItem(id, 'tool', catalog);

    if (result.resolved) {
      tools.push(result.item);
    } else {
      denials.push(result.denial);
    }
  };

  const resolveSkill = (id: string): void => {
    if (!firstSight(id)) {
      return;
    }

    const result = resolveItem(id, 'skill', catalog);

    if (!result.resolved) {
      denials.push(result.denial);
      return;
    }

    skills.push(result.item);

    for (const each of result.item.tools) {
      resolveTool(each.value);
    }
  };

  for (const each of request.tools) {
    resolveTool(each);
  }

  for (const each of request.skills) {
    resolveSkill(each);
  }

  return { tools, skills, denied: denials };
};

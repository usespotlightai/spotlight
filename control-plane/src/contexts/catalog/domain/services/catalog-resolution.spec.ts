import {
  type CatalogItem,
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogItems } from '@catalog/domain/repositories/catalog-items.repository';
import {
  resolveItem,
  resolveItems,
} from '@catalog/domain/services/catalog-resolution';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import { describe, expect, it } from 'vitest';

const metadata = (name: string) => ({
  name: CatalogName.of(name),
  version: CatalogVersion.of('1.0.0'),
  description: `The ${name} item.`,
});

const tool = (name: string) => CatalogTool.of(metadata(name), []);

const skill = (name: string, tools: readonly string[]) =>
  CatalogSkill.of(
    metadata(name),
    [{ path: 'SKILL.md', text: `# ${name}` }],
    tools.map((each) => CatalogItemId.parse(each)),
  );

const catalogOf = (items: readonly CatalogItem[]): CatalogItems => ({
  versionsOf: (kind, name) =>
    items.filter(
      (each) => each.kind === kind && each.metadata.name.equals(name),
    ),
  find: (id) => items.find((each) => each.id.equals(id)) ?? null,
});

const CATALOG = catalogOf([
  tool('fetch-page'),
  tool('web-search'),
  tool('audit-log'),
  skill('research', ['catalog.web-search@1.0.0', 'catalog.fetch-page@1.0.0']),
]);

const ids = (items: readonly CatalogItem[]) =>
  items.map((each) => each.id.value);

describe('resolveItem', () => {
  it('resolves an item of the kind named', () => {
    const result = resolveItem('catalog.web-search@1.0.0', 'tool', CATALOG);

    expect(result.resolved && result.item.id.value).toBe(
      'catalog.web-search@1.0.0',
    );
  });

  it('denies an id the catalog cannot read as unknown', () => {
    expect(resolveItem('web-search', 'tool', CATALOG)).toEqual({
      resolved: false,
      denial: {
        id: 'web-search',
        reason: 'unknown',
        detail: 'Catalog has no item web-search.',
      },
    });
  });

  it('denies a version the catalog does not have as unknown', () => {
    expect(
      resolveItem('catalog.web-search@9.0.0', 'tool', CATALOG),
    ).toMatchObject({ resolved: false, denial: { reason: 'unknown' } });
  });

  it('denies a skill named as a tool as the wrong kind', () => {
    expect(resolveItem('catalog.research@1.0.0', 'tool', CATALOG)).toEqual({
      resolved: false,
      denial: {
        id: 'catalog.research@1.0.0',
        reason: 'wrong-kind',
        detail: 'Catalog item catalog.research@1.0.0 is a skill, not a tool.',
      },
    });
  });
});

describe('resolveItems', () => {
  it('resolves a skill with the tools it uses', () => {
    const resolved = resolveItems(
      { tools: [], skills: ['catalog.research@1.0.0'] },
      CATALOG,
    );

    expect(ids(resolved.skills)).toEqual(['catalog.research@1.0.0']);
    expect(ids(resolved.tools)).toEqual([
      'catalog.web-search@1.0.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(resolved.denied).toEqual([]);
  });

  it('resolves or denies each id once, however often it is requested or used by a skill', () => {
    const resolved = resolveItems(
      {
        tools: [
          'catalog.web-search@1.0.0',
          'catalog.web-search@1.0.0',
          'catalog.audit-log@9.0.0',
          'catalog.audit-log@9.0.0',
        ],
        skills: ['catalog.research@1.0.0', 'catalog.research@1.0.0'],
      },
      CATALOG,
    );

    expect(ids(resolved.tools)).toEqual([
      'catalog.web-search@1.0.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(ids(resolved.skills)).toEqual(['catalog.research@1.0.0']);
    expect(resolved.denied.map((each) => each.id)).toEqual([
      'catalog.audit-log@9.0.0',
    ]);
  });

  it('denies a tool named as a skill and a skill named as a tool as the wrong kind', () => {
    const resolved = resolveItems(
      {
        tools: ['catalog.research@1.0.0'],
        skills: ['catalog.fetch-page@1.0.0'],
      },
      CATALOG,
    );

    expect(resolved.tools).toEqual([]);
    expect(resolved.skills).toEqual([]);
    expect(resolved.denied.map((each) => each.reason)).toEqual([
      'wrong-kind',
      'wrong-kind',
    ]);
  });
});

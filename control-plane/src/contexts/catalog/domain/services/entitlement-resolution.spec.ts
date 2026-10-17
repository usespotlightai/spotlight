import {
  type CatalogItem,
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogRepository } from '@catalog/domain/repositories/catalog.repository';
import {
  resolveEntitled,
  resolveEntitledFor,
  resolveEntitledItem,
} from '@catalog/domain/services/entitlement-resolution';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-23T12:00:00.000Z');

const LAPSED = new Date('2026-09-01T00:00:00.000Z');

const listing = (name: string, needs: Plan) => ({
  name: CatalogName.of(name),
  version: CatalogVersion.of('1.0.0'),
  needs,
  description: `The ${name} item.`,
});

const tool = (name: string, needs: Plan) =>
  CatalogTool.of(listing(name, needs), []);

const skill = (name: string, needs: Plan, brings: readonly string[]) =>
  CatalogSkill.of(
    listing(name, needs),
    [{ path: 'SKILL.md', text: `# ${name}` }],
    brings.map((each) => CatalogItemId.parse(each)),
  );

const catalogOf = (items: readonly CatalogItem[]): CatalogRepository => ({
  versionsOf: (kind, name) =>
    items.filter(
      (each) => each.kind === kind && each.listing.name.equals(name),
    ),
  find: (id) => items.find((each) => each.id.equals(id)) ?? null,
});

const CATALOG = catalogOf([
  tool('fetch-page', Plan.free),
  tool('web-search', Plan.team),
  tool('audit-log', Plan.enterprise),
  skill('research', Plan.free, [
    'catalog.web-search@1.0.0',
    'catalog.fetch-page@1.0.0',
  ]),
  skill('compliance', Plan.enterprise, ['catalog.audit-log@1.0.0']),
]);

const ids = (items: readonly CatalogItem[]) =>
  items.map((each) => each.id.value);

describe('resolveEntitled', () => {
  it('entitles an item of the kind named that the plan includes', () => {
    const result = resolveEntitled(
      'catalog.web-search@1.0.0',
      'tool',
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(result.entitled && result.item.id.value).toBe(
      'catalog.web-search@1.0.0',
    );
  });

  it('denies an id the catalog cannot read as unknown', () => {
    expect(
      resolveEntitled('web-search', 'tool', CATALOG, WorkspacePlan.free, NOW),
    ).toEqual({
      entitled: false,
      denial: {
        id: 'web-search',
        reason: 'unknown',
        detail: 'Catalog has no item web-search.',
      },
    });
  });

  it('denies a version the catalog does not have as unknown', () => {
    expect(
      resolveEntitled(
        'catalog.web-search@9.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.enterprise),
        NOW,
      ),
    ).toMatchObject({ entitled: false, denial: { reason: 'unknown' } });
  });

  it('denies a skill named as a tool as the wrong kind', () => {
    expect(
      resolveEntitled(
        'catalog.research@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.team),
        NOW,
      ),
    ).toEqual({
      entitled: false,
      denial: {
        id: 'catalog.research@1.0.0',
        reason: 'wrong-kind',
        detail: 'Catalog item catalog.research@1.0.0 is a skill, not a tool.',
      },
    });
  });

  it('denies what the plan does not include, naming the plan it needs', () => {
    expect(
      resolveEntitled(
        'catalog.web-search@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.free,
        NOW,
      ),
    ).toEqual({
      entitled: false,
      denial: {
        id: 'catalog.web-search@1.0.0',
        reason: 'not-entitled',
        detail:
          'Catalog item catalog.web-search@1.0.0 needs the Team plan. Workspace plan: Free',
      },
    });
  });

  it('denies what a plan past the day it lapses included, as lapsed', () => {
    expect(
      resolveEntitled(
        'catalog.web-search@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.team, LAPSED),
        NOW,
      ),
    ).toMatchObject({ entitled: false, denial: { reason: 'lapsed' } });
  });

  it('denies what a lapsed plan never included as not entitled, not as lapsed', () => {
    expect(
      resolveEntitled(
        'catalog.web-search@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.free, LAPSED),
        NOW,
      ),
    ).toMatchObject({ entitled: false, denial: { reason: 'not-entitled' } });
  });
});

describe('resolveEntitledItem', () => {
  it('denies an item already found by the same entitlement rule', () => {
    expect(
      resolveEntitledItem(
        tool('web-search', Plan.team),
        WorkspacePlan.free,
        NOW,
      ),
    ).toMatchObject({
      entitled: false,
      denial: { id: 'catalog.web-search@1.0.0', reason: 'not-entitled' },
    });
  });
});

describe('resolveEntitledFor', () => {
  it('entitles a skill with the tools it brings', () => {
    const entitled = resolveEntitledFor(
      { tools: [], skills: ['catalog.research@1.0.0'] },
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(ids(entitled.skills)).toEqual(['catalog.research@1.0.0']);
    expect(ids(entitled.tools)).toEqual([
      'catalog.web-search@1.0.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(entitled.denied).toEqual([]);
  });

  it('checks each tool a skill brings against the plan on its own', () => {
    const entitled = resolveEntitledFor(
      { tools: [], skills: ['catalog.research@1.0.0'] },
      CATALOG,
      WorkspacePlan.free,
      NOW,
    );

    expect(ids(entitled.skills)).toEqual(['catalog.research@1.0.0']);
    expect(ids(entitled.tools)).toEqual(['catalog.fetch-page@1.0.0']);
    expect(entitled.denied).toMatchObject([
      { id: 'catalog.web-search@1.0.0', reason: 'not-entitled' },
    ]);
  });

  it('brings none of the tools of a skill it denies', () => {
    const entitled = resolveEntitledFor(
      { tools: [], skills: ['catalog.compliance@1.0.0'] },
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(entitled.skills).toEqual([]);
    expect(entitled.tools).toEqual([]);
    expect(entitled.denied).toMatchObject([
      { id: 'catalog.compliance@1.0.0', reason: 'not-entitled' },
    ]);
  });

  it('entitles or denies each id once, however often it is named or brought', () => {
    const entitled = resolveEntitledFor(
      {
        tools: [
          'catalog.web-search@1.0.0',
          'catalog.web-search@1.0.0',
          'catalog.audit-log@1.0.0',
          'catalog.audit-log@1.0.0',
        ],
        skills: ['catalog.research@1.0.0', 'catalog.research@1.0.0'],
      },
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(ids(entitled.tools)).toEqual([
      'catalog.web-search@1.0.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(ids(entitled.skills)).toEqual(['catalog.research@1.0.0']);
    expect(entitled.denied.map((each) => each.id)).toEqual([
      'catalog.audit-log@1.0.0',
    ]);
  });

  it('denies a tool named as a skill and a skill named as a tool as the wrong kind', () => {
    const entitled = resolveEntitledFor(
      {
        tools: ['catalog.research@1.0.0'],
        skills: ['catalog.fetch-page@1.0.0'],
      },
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(entitled.tools).toEqual([]);
    expect(entitled.skills).toEqual([]);
    expect(entitled.denied.map((each) => each.reason)).toEqual([
      'wrong-kind',
      'wrong-kind',
    ]);
  });
});

import {
  type CatalogItem,
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogRepository } from '@catalog/domain/repositories/catalog.repository';
import {
  givingOf,
  givingOfItem,
  givingsTo,
} from '@catalog/domain/services/giving';
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

describe('givingOf', () => {
  it('gives an item of the kind named that the plan includes', () => {
    const giving = givingOf(
      'catalog.web-search@1.0.0',
      'tool',
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(giving.given && giving.item.id.value).toBe(
      'catalog.web-search@1.0.0',
    );
  });

  it('refuses an id the catalog cannot read as unknown', () => {
    expect(
      givingOf('web-search', 'tool', CATALOG, WorkspacePlan.free, NOW),
    ).toEqual({
      given: false,
      refusal: {
        id: 'web-search',
        reason: 'unknown',
        because: 'web-search is not in the catalog',
      },
    });
  });

  it('refuses a version the catalog does not have as unknown', () => {
    expect(
      givingOf(
        'catalog.web-search@9.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.enterprise),
        NOW,
      ),
    ).toMatchObject({ given: false, refusal: { reason: 'unknown' } });
  });

  it('refuses a skill named as a tool as the wrong kind', () => {
    expect(
      givingOf(
        'catalog.research@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.team),
        NOW,
      ),
    ).toEqual({
      given: false,
      refusal: {
        id: 'catalog.research@1.0.0',
        reason: 'wrong-kind',
        because: 'catalog.research@1.0.0 is a catalog skill, not a tool',
      },
    });
  });

  it('refuses what the plan does not include, naming the plan it needs', () => {
    expect(
      givingOf(
        'catalog.web-search@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.free,
        NOW,
      ),
    ).toEqual({
      given: false,
      refusal: {
        id: 'catalog.web-search@1.0.0',
        reason: 'not-entitled',
        because:
          'catalog.web-search@1.0.0 needs the Team plan, and this workspace is on the Free plan',
      },
    });
  });

  it('refuses what a plan past the day it lapses included, as lapsed', () => {
    expect(
      givingOf(
        'catalog.web-search@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.team, LAPSED),
        NOW,
      ),
    ).toMatchObject({ given: false, refusal: { reason: 'lapsed' } });
  });

  it('refuses what a lapsed plan never included as not entitled, not as lapsed', () => {
    expect(
      givingOf(
        'catalog.web-search@1.0.0',
        'tool',
        CATALOG,
        WorkspacePlan.of(Plan.free, LAPSED),
        NOW,
      ),
    ).toMatchObject({ given: false, refusal: { reason: 'not-entitled' } });
  });
});

describe('givingOfItem', () => {
  it('refuses an item already found by the same entitlement rule', () => {
    expect(
      givingOfItem(tool('web-search', Plan.team), WorkspacePlan.free, NOW),
    ).toMatchObject({
      given: false,
      refusal: { id: 'catalog.web-search@1.0.0', reason: 'not-entitled' },
    });
  });
});

describe('givingsTo', () => {
  it('gives a skill with the tools it brings', () => {
    const givings = givingsTo(
      { tools: [], skills: ['catalog.research@1.0.0'] },
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(ids(givings.skills)).toEqual(['catalog.research@1.0.0']);
    expect(ids(givings.tools)).toEqual([
      'catalog.web-search@1.0.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(givings.refused).toEqual([]);
  });

  it('checks each tool a skill brings against the plan on its own', () => {
    const givings = givingsTo(
      { tools: [], skills: ['catalog.research@1.0.0'] },
      CATALOG,
      WorkspacePlan.free,
      NOW,
    );

    expect(ids(givings.skills)).toEqual(['catalog.research@1.0.0']);
    expect(ids(givings.tools)).toEqual(['catalog.fetch-page@1.0.0']);
    expect(givings.refused).toMatchObject([
      { id: 'catalog.web-search@1.0.0', reason: 'not-entitled' },
    ]);
  });

  it('brings none of the tools of a skill it refuses', () => {
    const givings = givingsTo(
      { tools: [], skills: ['catalog.compliance@1.0.0'] },
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(givings.skills).toEqual([]);
    expect(givings.tools).toEqual([]);
    expect(givings.refused).toMatchObject([
      { id: 'catalog.compliance@1.0.0', reason: 'not-entitled' },
    ]);
  });

  it('gives or refuses each id once, however often it is named or brought', () => {
    const givings = givingsTo(
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

    expect(ids(givings.tools)).toEqual([
      'catalog.web-search@1.0.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(ids(givings.skills)).toEqual(['catalog.research@1.0.0']);
    expect(givings.refused.map((each) => each.id)).toEqual([
      'catalog.audit-log@1.0.0',
    ]);
  });

  it('refuses a tool named as a skill and a skill named as a tool as the wrong kind', () => {
    const givings = givingsTo(
      {
        tools: ['catalog.research@1.0.0'],
        skills: ['catalog.fetch-page@1.0.0'],
      },
      CATALOG,
      WorkspacePlan.of(Plan.team),
      NOW,
    );

    expect(givings.tools).toEqual([]);
    expect(givings.skills).toEqual([]);
    expect(givings.refused.map((each) => each.reason)).toEqual([
      'wrong-kind',
      'wrong-kind',
    ]);
  });
});

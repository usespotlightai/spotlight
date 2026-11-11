import { CatalogEntitlements } from '@catalog/application/services/catalog-entitlements.service';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-23T12:00:00.000Z');

const WORKSPACE = WorkspaceId.of('ws_1');

const entitlements = (plan: WorkspacePlan) => ({
  service: new CatalogEntitlements(
    new StaticCatalog(CATALOG_ITEMS),
    { of: async () => plan },
    { now: () => NOW, sleep: async () => {} },
  ),
});

const tools = (...ids: string[]) => ({ tools: ids, skills: [] });

describe('CatalogEntitlements', () => {
  it('entitles what the workspace’s plan includes', async () => {
    const { service } = entitlements(WorkspacePlan.of(Plan.team));

    const entitled = await service.entitledTo(
      WORKSPACE,
      tools('catalog.web-search@1.1.0'),
    );

    expect(entitled.tools.map((each) => each.id)).toEqual([
      'catalog.web-search@1.1.0',
    ]);
    expect(entitled.denied).toEqual([]);
  });

  it('denies what the plan does not include, naming the plan it requires', async () => {
    const { service } = entitlements(WorkspacePlan.free);

    const entitled = await service.entitledTo(
      WORKSPACE,
      tools('catalog.web-search@1.1.0', 'catalog.fetch-page@1.0.0'),
    );

    expect(entitled.tools.map((each) => each.id)).toEqual([
      'catalog.fetch-page@1.0.0',
    ]);
    expect(entitled.denied).toEqual([
      {
        id: 'catalog.web-search@1.1.0',
        reason: 'not-entitled',
        because:
          'Catalog item catalog.web-search@1.1.0 requires the Team plan. Workspace plan: Free',
      },
    ]);
  });

  it('entitles a skill with the tools it uses, once each', async () => {
    const { service } = entitlements(WorkspacePlan.of(Plan.team));

    const entitled = await service.entitledTo(WORKSPACE, {
      tools: ['catalog.web-search@1.1.0'],
      skills: ['catalog.research@1.0.0'],
    });

    expect(entitled.skills.map((each) => each.id)).toEqual([
      'catalog.research@1.0.0',
    ]);
    expect(entitled.skills[0]?.files.map((each) => each.path)).toEqual([
      'SKILL.md',
    ]);
    expect(entitled.tools.map((each) => each.id)).toEqual([
      'catalog.web-search@1.1.0',
      'catalog.fetch-page@1.0.0',
    ]);
  });
});

import { CatalogResolutions } from '@catalog/application/services/catalog-resolutions.service';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { describe, expect, it } from 'vitest';

const service = new CatalogResolutions(new StaticCatalog(CATALOG_ITEMS));

const tools = (...ids: string[]) => ({ tools: ids, skills: [] });

describe('CatalogResolutions', () => {
  it('resolves every tool of the catalog, web-search too', async () => {
    const resolved = await service.resolve(
      tools(
        'catalog.web-search@1.0.0',
        'catalog.web-search@1.1.0',
        'catalog.fetch-page@1.0.0',
      ),
    );

    expect(resolved.tools.map((each) => each.id)).toEqual([
      'catalog.web-search@1.0.0',
      'catalog.web-search@1.1.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(resolved.denied).toEqual([]);
  });

  it('denies an item the catalog does not have, naming it', async () => {
    const resolved = await service.resolve(
      tools('catalog.web-search@9.0.0', 'catalog.fetch-page@1.0.0'),
    );

    expect(resolved.tools.map((each) => each.id)).toEqual([
      'catalog.fetch-page@1.0.0',
    ]);
    expect(resolved.denied).toEqual([
      {
        id: 'catalog.web-search@9.0.0',
        reason: 'unknown',
        because: 'Catalog has no item catalog.web-search@9.0.0.',
      },
    ]);
  });

  it('resolves a skill with the tools it uses, once each', async () => {
    const resolved = await service.resolve({
      tools: ['catalog.web-search@1.1.0'],
      skills: ['catalog.research@1.0.0'],
    });

    expect(resolved.skills.map((each) => each.id)).toEqual([
      'catalog.research@1.0.0',
    ]);
    expect(resolved.skills[0]?.files.map((each) => each.path)).toEqual([
      'SKILL.md',
    ]);
    expect(resolved.tools.map((each) => each.id)).toEqual([
      'catalog.web-search@1.1.0',
      'catalog.fetch-page@1.0.0',
    ]);
  });
});

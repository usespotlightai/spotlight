import type { CatalogTool } from '@catalog/domain/entities/catalog-item.entity';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { AlwaysAllowedCatalogService } from '@catalog/infrastructure/service/always-allowed-catalog-service';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const webSearch = (): CatalogTool => {
  const found = CATALOG_ITEMS.find((each) =>
    each.id.equals(CatalogItemId.parse('catalog.web-search@1.1.0')),
  );

  if (found?.kind !== 'tool') {
    throw new Error('the catalog has no web-search tool');
  }

  return found;
};

const ON = { workspaceId: WorkspaceId.of('ws_1'), runId: RunId.of('run_1') };

const serving = (status: number, body: unknown) => {
  const sent: { url: string; init: RequestInit }[] = [];
  const service = new AlwaysAllowedCatalogService(
    'https://catalog.example.com/v1',
    'catalog-token',
    async (url, init) => {
      sent.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(body), { status });
    },
  );

  return { service, sent };
};

describe('AlwaysAllowedCatalogService', () => {
  it('calls the version enabled for the run, on the catalog service alone, for the workspace and run', async () => {
    const { service, sent } = serving(200, { output: ['https://example.com'] });

    await expect(
      service.call(webSearch(), { query: 'queues' }, ON),
    ).resolves.toEqual(['https://example.com']);
    expect(sent[0]?.url).toBe(
      'https://catalog.example.com/v1/tools/web-search/1.1.0',
    );
    expect(sent[0]?.init.headers).toMatchObject({
      authorization: 'Bearer catalog-token',
      'spotlight-workspace': 'ws_1',
      'spotlight-run': 'run_1',
    });
    expect(JSON.parse(String(sent[0]?.init.body))).toEqual({
      inputs: { query: 'queues' },
    });
  });

  it('says the catalog failed when it answers with anything but an output', async () => {
    const { service } = serving(502, { error: 'down' });

    await expect(service.call(webSearch(), {}, ON)).rejects.toThrow(
      UpstreamError,
    );
  });
});

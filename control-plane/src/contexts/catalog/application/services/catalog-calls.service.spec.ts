import { CatalogCalls } from '@catalog/application/services/catalog-calls.service';
import type { CatalogTool } from '@catalog/domain/entities/catalog-item.entity';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const calling = (id: string) => ({
  workspaceId: WORKSPACE,
  runId: RunId.of('run_1'),
  id,
  inputs: { query: 'queues' },
});

const catalogCalls = (
  answering: (tool: CatalogTool) => Promise<unknown> = () =>
    Promise.resolve('Three pages.'),
) => {
  const called: { tool: string; workspaceId: string; runId: string }[] = [];

  const service = new CatalogCalls(new StaticCatalog(CATALOG_ITEMS), {
    call: async (tool, _inputs, on) => {
      called.push({
        tool: tool.id.value,
        workspaceId: on.workspaceId.value,
        runId: on.runId.value,
      });
      return answering(tool);
    },
  });

  return { service, called };
};

describe('CatalogCalls', () => {
  it('calls the version named for any workspace, web-search too, and answers with its output', async () => {
    const { service, called } = catalogCalls();

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).resolves.toEqual({ kind: 'answered', output: 'Three pages.' });
    expect(called).toEqual([
      { tool: 'catalog.web-search@1.1.0', workspaceId: 'ws_1', runId: 'run_1' },
    ]);
  });

  it('passes on a failure of the catalog service', async () => {
    const { service } = catalogCalls(() =>
      Promise.reject(new UpstreamError('calling', 'down')),
    );

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).rejects.toThrow(UpstreamError);
  });

  it('calls nothing the catalog does not have', async () => {
    const { service, called } = catalogCalls();

    await expect(
      service.call(calling('catalog.web-search@9.0.0')),
    ).resolves.toMatchObject({
      kind: 'denied',
      denial: { reason: 'unknown' },
    });
    expect(called).toEqual([]);
  });

  it('calls no skill, as the wrong kind', async () => {
    const { service, called } = catalogCalls();

    await expect(
      service.call(calling('catalog.research@1.0.0')),
    ).resolves.toMatchObject({
      kind: 'denied',
      denial: { reason: 'wrong-kind' },
    });
    expect(called).toEqual([]);
  });
});

import { CatalogCalls } from '@catalog/application/services/catalog-calls.service';
import type { CatalogTool } from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogCall } from '@catalog/domain/value-objects/catalog-call.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-23T12:00:00.000Z');

const WORKSPACE = WorkspaceId.of('ws_1');

const calling = (id: string) => ({
  workspaceId: WORKSPACE,
  runId: RunId.of('run_1'),
  id,
  inputs: { query: 'queues' },
});

const catalogCalls = (
  plan: WorkspacePlan,
  answering: (tool: CatalogTool) => Promise<unknown> = async () =>
    'Three pages.',
) => {
  const recorded: CatalogCall[] = [];
  const called: string[] = [];
  let tick = 0;

  const service = new CatalogCalls(
    new StaticCatalog(CATALOG_ITEMS),
    { of: async () => plan },
    {
      record: async (call) => {
        recorded.push(call);
      },
      deleteForWorkspace: async () => undefined,
    },
    {
      call: async (tool) => {
        called.push(tool.id.value);
        return answering(tool);
      },
    },
    {
      now: () => new Date(NOW.getTime() + 40 * tick++),
      sleep: async () => {},
    },
  );

  return { service, recorded, called };
};

describe('CatalogCalls', () => {
  it('records each call it makes, by the version called', async () => {
    const { service, recorded } = catalogCalls(WorkspacePlan.of(Plan.team));

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).resolves.toEqual({ kind: 'answered', output: 'Three pages.' });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      runId: RunId.of('run_1'),
      succeeded: true,
      billable: true,
    });
    expect(recorded[0]?.item.value).toBe('catalog.web-search@1.1.0');
    expect(recorded[0]?.ms).toBeGreaterThan(0);
  });

  it('records a call the catalog service failed, as failed and not billable', async () => {
    const { service, recorded } = catalogCalls(
      WorkspacePlan.of(Plan.team),
      () => Promise.reject(new UpstreamError('calling', 'down')),
    );

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).rejects.toThrow(UpstreamError);
    expect(
      recorded.map((each) => ({
        succeeded: each.succeeded,
        billable: each.billable,
      })),
    ).toEqual([{ succeeded: false, billable: false }]);
  });

  it('calls and records nothing the plan no longer covers', async () => {
    const { service, recorded, called } = catalogCalls(
      WorkspacePlan.of(Plan.team, new Date('2026-09-01T00:00:00.000Z')),
    );

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).resolves.toMatchObject({
      kind: 'denied',
      denial: { reason: 'expired' },
    });
    expect(called).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it('calls no skill, as the wrong kind', async () => {
    const { service, called } = catalogCalls(WorkspacePlan.of(Plan.team));

    await expect(
      service.call(calling('catalog.research@1.0.0')),
    ).resolves.toMatchObject({
      kind: 'denied',
      denial: { reason: 'wrong-kind' },
    });
    expect(called).toEqual([]);
  });
});

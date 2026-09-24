import { CatalogGivings } from '@catalog/application/services/catalog-givings.service';
import type { CatalogTool } from '@catalog/domain/entities/catalog-item.entity';
import type { MeteredCall } from '@catalog/domain/value-objects/metered-call.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { SeededCatalog } from '@catalog/infrastructure/catalog/seeded-catalog';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-23T12:00:00.000Z');

const WORKSPACE = WorkspaceId.of('ws_1');

const givings = (
  plan: WorkspacePlan,
  answering: (tool: CatalogTool) => Promise<unknown> = async () =>
    'Three pages.',
) => {
  const metered: MeteredCall[] = [];
  const called: string[] = [];
  let tick = 0;

  const service = new CatalogGivings(
    new SeededCatalog(CATALOG_ITEMS),
    { of: async () => plan, forget: async () => undefined },
    {
      record: async (call) => {
        metered.push(call);
      },
      forget: async () => undefined,
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

  return { service, metered, called };
};

const tools = (...ids: string[]) => ({ tools: ids, skills: [] });

const calling = (id: string) => ({
  workspaceId: WORKSPACE,
  runId: RunId.of('run_1'),
  id,
  inputs: { query: 'queues' },
});

describe('CatalogGivings', () => {
  it('gives what the workspace’s plan includes', async () => {
    const { service } = givings(WorkspacePlan.of(Plan.team));

    const given = await service.givenTo(
      WORKSPACE,
      tools('catalog.web-search@1.1.0'),
    );

    expect(given.tools.map((each) => each.id)).toEqual([
      'catalog.web-search@1.1.0',
    ]);
    expect(given.refused).toEqual([]);
  });

  it('refuses what the plan does not include, naming the plan it needs', async () => {
    const { service } = givings(WorkspacePlan.free);

    const given = await service.givenTo(
      WORKSPACE,
      tools('catalog.web-search@1.1.0', 'catalog.fetch-page@1.0.0'),
    );

    expect(given.tools.map((each) => each.id)).toEqual([
      'catalog.fetch-page@1.0.0',
    ]);
    expect(given.refused).toEqual([
      {
        id: 'catalog.web-search@1.1.0',
        reason: 'not-entitled',
        because:
          'catalog.web-search@1.1.0 needs the Team plan, and this workspace is on the Free plan',
      },
    ]);
  });

  it('refuses what a plan past the day it lapses included, as lapsed', async () => {
    const { service } = givings(
      WorkspacePlan.of(Plan.team, new Date('2026-09-01T00:00:00.000Z')),
    );

    const given = await service.givenTo(
      WORKSPACE,
      tools('catalog.web-search@1.1.0'),
    );

    expect(given.refused).toEqual([
      {
        id: 'catalog.web-search@1.1.0',
        reason: 'lapsed',
        because:
          'catalog.web-search@1.1.0 needs the Team plan, and this workspace’s Team plan lapsed at 2026-09-01T00:00:00.000Z',
      },
    ]);
  });

  it('refuses what a lapsed plan never included as not entitled, not as lapsed', async () => {
    const { service } = givings(
      WorkspacePlan.of(Plan.free, new Date('2026-09-01T00:00:00.000Z')),
    );

    const given = await service.givenTo(
      WORKSPACE,
      tools('catalog.web-search@1.1.0'),
    );

    expect(given.refused.map((each) => each.reason)).toEqual(['not-entitled']);
  });

  it('refuses a skill named as a tool, and a tool named as a skill, as the wrong kind', async () => {
    const { service } = givings(WorkspacePlan.of(Plan.team));

    const given = await service.givenTo(WORKSPACE, {
      tools: ['catalog.research@1.0.0'],
      skills: ['catalog.fetch-page@1.0.0'],
    });

    expect(given.tools).toEqual([]);
    expect(given.skills).toEqual([]);
    expect(given.refused).toEqual([
      {
        id: 'catalog.research@1.0.0',
        reason: 'wrong-kind',
        because: 'catalog.research@1.0.0 is a catalog skill, not a tool',
      },
      {
        id: 'catalog.fetch-page@1.0.0',
        reason: 'wrong-kind',
        because: 'catalog.fetch-page@1.0.0 is a catalog tool, not a skill',
      },
    ]);
  });

  it('refuses what the catalog does not have', async () => {
    const { service } = givings(WorkspacePlan.of(Plan.enterprise));

    const given = await service.givenTo(
      WORKSPACE,
      tools('catalog.web-search@9.0.0'),
    );

    expect(given.refused).toEqual([
      {
        id: 'catalog.web-search@9.0.0',
        reason: 'unknown',
        because: 'catalog.web-search@9.0.0 is not in the catalog',
      },
    ]);
  });

  it('gives a skill with the tools it brings, once each', async () => {
    const { service } = givings(WorkspacePlan.of(Plan.team));

    const given = await service.givenTo(WORKSPACE, {
      tools: ['catalog.web-search@1.1.0'],
      skills: ['catalog.research@1.0.0'],
    });

    expect(given.skills.map((each) => each.id)).toEqual([
      'catalog.research@1.0.0',
    ]);
    expect(given.skills[0]?.files.map((each) => each.path)).toEqual([
      'SKILL.md',
    ]);
    expect(given.tools.map((each) => each.id)).toEqual([
      'catalog.web-search@1.1.0',
      'catalog.fetch-page@1.0.0',
    ]);
  });

  it('meters each call it makes, by the version called', async () => {
    const { service, metered } = givings(WorkspacePlan.of(Plan.team));

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).resolves.toEqual({ kind: 'answered', output: 'Three pages.' });

    expect(metered).toHaveLength(1);
    expect(metered[0]).toMatchObject({
      runId: RunId.of('run_1'),
      succeeded: true,
      billable: true,
    });
    expect(metered[0]?.item.value).toBe('catalog.web-search@1.1.0');
    expect(metered[0]?.ms).toBeGreaterThan(0);
  });

  it('meters a call the catalog service failed, as failed and not billable', async () => {
    const { service, metered } = givings(WorkspacePlan.of(Plan.team), () =>
      Promise.reject(new UpstreamRefusedError('calling', 'down')),
    );

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).rejects.toThrow(UpstreamRefusedError);
    expect(
      metered.map((each) => ({
        succeeded: each.succeeded,
        billable: each.billable,
      })),
    ).toEqual([{ succeeded: false, billable: false }]);
  });

  it('calls and meters nothing the plan no longer covers', async () => {
    const { service, metered, called } = givings(
      WorkspacePlan.of(Plan.team, new Date('2026-09-01T00:00:00.000Z')),
    );

    await expect(
      service.call(calling('catalog.web-search@1.1.0')),
    ).resolves.toMatchObject({
      kind: 'refused',
      refusal: { reason: 'lapsed' },
    });
    expect(called).toEqual([]);
    expect(metered).toEqual([]);
  });

  it('calls no skill, as the wrong kind', async () => {
    const { service, called } = givings(WorkspacePlan.of(Plan.team));

    await expect(
      service.call(calling('catalog.research@1.0.0')),
    ).resolves.toMatchObject({
      kind: 'refused',
      refusal: { reason: 'wrong-kind' },
    });
    expect(called).toEqual([]);
  });
});

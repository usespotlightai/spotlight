import type { HostOutagesPort } from '@runners/application/ports/host-outages.port';
import {
  HOST_OUTAGE_BEGAN,
  type HostOutageBeganIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import {
  HOST_OUTAGE_ENDED,
  type HostOutageEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TellAdminsOfHostOutages } from '@work/application/events/handlers/tell-admins-of-host-outages.handler';
import type {
  NoticeOf,
  NoticesPort,
} from '@work/application/ports/notices.port';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const BEGAN: HostOutageBeganIntegrationEvent = {
  kind: HOST_OUTAGE_BEGAN,
  outageId: 'outage_1',
  workspaceId: WORKSPACE.value,
  source: 'pool',
  sourceId: 'pool_1',
  sourceKey: 'default',
  hosts: ['dev-host'],
  since: '2026-11-27T20:00:00.000Z',
};

const ENDED: HostOutageEndedIntegrationEvent = {
  kind: HOST_OUTAGE_ENDED,
  outageId: 'outage_1',
  workspaceId: WORKSPACE.value,
  source: 'pool',
  sourceId: 'pool_1',
};

const telling = (open: string | null) => {
  const raised: NoticeOf[] = [];
  const notices = partial<NoticesPort>({
    raise: async (notice: NoticeOf) => {
      raised.push(notice);
    },
    resolveInWorkspace: vi.fn(async () => {}),
  });
  const openOutageOf = vi.fn(async () => open);

  return {
    raised,
    notices,
    openOutageOf,
    handler: new TellAdminsOfHostOutages(
      { openOutageOf } satisfies HostOutagesPort,
      notices,
    ),
  };
};

describe('TellAdminsOfHostOutages', () => {
  it('raises one notice about the whole workspace for its admins, which leads to the runners settings', async () => {
    const { handler, raised, openOutageOf } = telling('outage_1');

    await handler.began(BEGAN);

    expect(openOutageOf).toHaveBeenCalledWith({ kind: 'pool', id: 'pool_1' });
    expect(raised).toEqual([
      expect.objectContaining({
        workspaceId: WORKSPACE,
        teamId: null,
        addressee: null,
        form: 'advice',
        subject: 'host-outage pool:pool_1',
        link: 'settings/runners',
        headline: 'dev-host, the only host of the pool default, is offline',
      }),
    ]);
  });

  it('counts the hosts when the pool has several', async () => {
    const { handler, raised } = telling('outage_1');

    await handler.began({ ...BEGAN, hosts: ['dev-host', 'ci-host'] });

    expect(raised[0]?.headline).toBe(
      'All 2 hosts of the pool default are offline',
    );
  });

  it('raises nothing for an outage that ended before its event arrived', async () => {
    const { handler, raised } = telling(null);

    await handler.began(BEGAN);

    expect(raised).toEqual([]);
  });

  it('resolves the notice once the outage ends', async () => {
    const { handler, notices } = telling(null);

    await handler.ended(ENDED);

    expect(notices.resolveInWorkspace).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      form: 'advice',
      subject: 'host-outage pool:pool_1',
    });
  });

  it('leaves the notice open when a later outage of the same hosts holds by the time the end arrives', async () => {
    const { handler, notices } = telling('outage_2');

    await handler.ended(ENDED);

    expect(notices.resolveInWorkspace).not.toHaveBeenCalled();
  });
});

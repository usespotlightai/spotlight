import type { HostOutagesPort } from '@runners/application/ports/host-outages.port';
import {
  HOST_OUTAGE_BEGAN,
  type HostOutageBeganIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import { HOST_OUTAGE_ENDED } from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TellAdminsOfHostOutages } from '@work/application/events/handlers/tell-admins-of-host-outages.handler';
import type { Notices } from '@work/application/services/notices.service';
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

const RESOLVED = {
  workspaceId: WORKSPACE,
  form: 'advice',
  subject: 'host-outage outage_1',
};

const telling = (...open: (string | null)[]) => {
  const notices = partial<Notices>({
    createAboutWorkspace: vi.fn(async () => {}),
    resolveInWorkspace: vi.fn(async () => {}),
  });
  const openOutageOf = vi.fn<HostOutagesPort['openOutageOf']>();

  for (const each of open) {
    openOutageOf.mockResolvedValueOnce(each);
  }

  return {
    notices,
    openOutageOf,
    handler: new TellAdminsOfHostOutages({ openOutageOf }, notices),
  };
};

describe('TellAdminsOfHostOutages', () => {
  it('creates one notice about the whole workspace for its admins, which leads to the runners settings and resolves itself', async () => {
    const { handler, notices, openOutageOf } = telling('outage_1', 'outage_1');

    await handler.began(BEGAN);

    expect(openOutageOf).toHaveBeenCalledWith({ kind: 'pool', id: 'pool_1' });
    expect(notices.createAboutWorkspace).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        workspaceId: WORKSPACE,
        form: 'advice',
        subject: 'host-outage outage_1',
        link: 'settings/runners',
        headline: 'dev-host, the only host of the pool default, is offline',
        autoResolve: true,
      }),
    );
    expect(notices.resolveInWorkspace).not.toHaveBeenCalled();
  });

  it('counts the hosts when the pool has several', async () => {
    const { handler, notices } = telling('outage_1', 'outage_1');

    await handler.began({ ...BEGAN, hosts: ['dev-host', 'ci-host'] });

    expect(notices.createAboutWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'All 2 hosts of the pool default are offline',
      }),
    );
  });

  it('creates nothing for an outage that ended before its beginning arrived', async () => {
    const { handler, notices } = telling(null);

    await handler.began(BEGAN);

    expect(notices.createAboutWorkspace).not.toHaveBeenCalled();
  });

  it('resolves the notice it just created when the outage ended meanwhile', async () => {
    const { handler, notices } = telling('outage_1', null);

    await handler.began(BEGAN);

    expect(notices.createAboutWorkspace).toHaveBeenCalledOnce();
    expect(notices.resolveInWorkspace).toHaveBeenCalledWith(RESOLVED);
  });

  it('resolves the notice of the outage once it ends', async () => {
    const { handler, notices } = telling();

    await handler.ended({
      kind: HOST_OUTAGE_ENDED,
      outageId: 'outage_1',
      workspaceId: WORKSPACE.value,
      source: 'pool',
      sourceId: 'pool_1',
    });

    expect(notices.resolveInWorkspace).toHaveBeenCalledWith(RESOLVED);
  });
});

import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  HOST_OUTAGE_BEGAN,
  type HostOutageBeganIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import { HOST_OUTAGE_ENDED } from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TellAdminsOfHostOutages } from '@work/application/events/handlers/tell-admins-of-host-outages.handler';
import type {
  NoticeOf,
  NoticesPort,
} from '@work/application/ports/notices.port';
import { WorkAccess } from '@work/application/services/work-access.service';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const PLATFORM = TeamId.of('team_platform');

const BILLING = TeamId.of('team_billing');

const member = (viewer: string, isAdmin: boolean, seen: readonly TeamId[]) => ({
  workspaceId: WORKSPACE,
  viewer: UserId.of(viewer),
  isAdmin,
  teams: [PLATFORM, BILLING].map((teamId) => ({
    teamId,
    sees: seen.some((each) => each.equals(teamId)),
    actsOn: true,
    joined: false,
  })),
});

const BEGAN: HostOutageBeganIntegrationEvent = {
  kind: HOST_OUTAGE_BEGAN,
  outageId: 'outage_1',
  workspaceId: WORKSPACE.value,
  source: 'pool',
  sourceKey: 'default',
  hosts: ['dev-host'],
  since: '2026-11-27T20:00:00.000Z',
};

const telling = () => {
  const created: NoticeOf[] = [];
  const notices = partial<NoticesPort>({
    create: async (notice: NoticeOf) => {
      created.push(notice);
    },
    resolveEverywhere: vi.fn(async () => {}),
  });
  const access = new WorkAccess(
    partial<WorkspaceAccessPort>({
      teamAccessOfMembers: async () => [
        member('owner_1', true, [BILLING, PLATFORM]),
        member('admin_1', true, [PLATFORM]),
        member('admin_2', true, []),
        member('member_1', false, [PLATFORM]),
      ],
    }),
    partial({}),
    partial({}),
  );

  return {
    created,
    notices,
    handler: new TellAdminsOfHostOutages(access, notices),
  };
};

describe('TellAdminsOfHostOutages', () => {
  it('gives each admin who sees a team one notice that leads to the runners settings, and members none', async () => {
    const { handler, created } = telling();

    await handler.began(BEGAN);

    expect(
      created.map((each) => [each.addressee?.value, each.teamId.value]),
    ).toEqual([
      ['owner_1', 'team_platform'],
      ['admin_1', 'team_platform'],
    ]);
    expect(created[0]).toMatchObject({
      workspaceId: WORKSPACE,
      form: 'advice',
      subject: 'host-outage outage_1',
      link: 'settings/runners',
      linkScope: 'workspace',
      headline: 'dev-host, the only host of the pool default, is offline',
    });
  });

  it('counts the hosts when the pool has several', async () => {
    const { handler, created } = telling();

    await handler.began({ ...BEGAN, hosts: ['dev-host', 'ci-host'] });

    expect(created[0]?.headline).toBe(
      'All 2 hosts of the pool default are offline',
    );
  });

  it('resolves the notices of the outage everywhere once it ends', async () => {
    const { handler, notices } = telling();

    await handler.ended({
      kind: HOST_OUTAGE_ENDED,
      outageId: 'outage_1',
      workspaceId: WORKSPACE.value,
    });

    expect(notices.resolveEverywhere).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      form: 'advice',
      subject: 'host-outage outage_1',
    });
  });
});

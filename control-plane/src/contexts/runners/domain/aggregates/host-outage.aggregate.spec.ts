import { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';
import { POOL_ID } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { HostOutageBegan } from '@runners/domain/events/host-outage-began.event';
import { HostOutageEnded } from '@runners/domain/events/host-outage-ended.event';
import {
  aNamedHost,
  minutesAfter,
} from '@runners/domain/services/host-outages.fake-spec';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const SOURCE = CredentialSource.ofId(POOL_ID);

const POOL_WORKSPACE = WorkspaceId.of('ws_1');

const raised = () =>
  HostOutage.raise({
    id: HostOutageId.of('outage_1'),
    outage: {
      source: SOURCE,
      hosts: [aNamedHost('dev-host')],
      since: minutesAfter(0),
    },
    workspaceId: POOL_WORKSPACE,
    sourceKey: 'ephemeral',
    at: minutesAfter(5),
  });

describe('HostOutage', () => {
  it('records that it began, with the names of the quiet hosts', () => {
    expect(raised().pullEvents()).toEqual([
      new HostOutageBegan(
        HostOutageId.of('outage_1'),
        POOL_WORKSPACE,
        SOURCE,
        'ephemeral',
        ['dev-host'],
        minutesAfter(0),
        minutesAfter(5),
      ),
    ]);
  });

  it('records that it ended once, however often it is ended', () => {
    const outage = raised();
    outage.pullEvents();

    expect(
      outage.end(minutesAfter(9)).end(minutesAfter(10)).pullEvents(),
    ).toEqual([
      new HostOutageEnded(
        HostOutageId.of('outage_1'),
        POOL_WORKSPACE,
        minutesAfter(9),
      ),
    ]);
  });

  it('holds while its source is among the outages of the workspace', () => {
    const outage = raised();

    expect(
      outage.holdsAmong([
        { source: SOURCE, hosts: [], since: minutesAfter(0) },
      ]),
    ).toBe(true);
    expect(outage.holdsAmong([])).toBe(false);
  });

  it('refuses a stored outage raised before its hosts went quiet', () => {
    expect(() =>
      HostOutage.rehydrate({
        id: HostOutageId.of('outage_1'),
        workspaceId: POOL_WORKSPACE,
        source: SOURCE,
        since: minutesAfter(5),
        raisedAt: minutesAfter(0),
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});

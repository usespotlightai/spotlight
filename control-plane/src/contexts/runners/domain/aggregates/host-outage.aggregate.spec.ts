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

const WORKSPACE = WorkspaceId.of('ws_1');

const ID = HostOutageId.of('outage_1');

const raised = (at = minutesAfter(5)) =>
  HostOutage.raise({
    id: ID,
    workspaceId: WORKSPACE,
    outage: { source: SOURCE, hosts: ['dev-host'], since: minutesAfter(0) },
    sourceKey: 'ephemeral',
    at,
  });

describe('HostOutage', () => {
  it('records that it began, with the names of the quiet hosts', () => {
    expect(raised().pullEvents()).toEqual([
      new HostOutageBegan(
        ID,
        WORKSPACE,
        SOURCE,
        'ephemeral',
        ['dev-host'],
        minutesAfter(0),
        minutesAfter(5),
      ),
    ]);
  });

  it('refuses to be raised before its hosts went quiet, as when stored so', () => {
    expect(() => raised(new Date(minutesAfter(0).getTime() - 1))).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      HostOutage.rehydrate({
        id: ID,
        workspaceId: WORKSPACE,
        source: SOURCE,
        hosts: ['dev-host'],
        since: minutesAfter(5),
        raisedAt: minutesAfter(0),
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('records that it ended once, however often it is ended', () => {
    const outage = raised();
    outage.pullEvents();

    expect(
      outage.end(minutesAfter(9)).end(minutesAfter(10)).pullEvents(),
    ).toEqual([new HostOutageEnded(ID, WORKSPACE, SOURCE, minutesAfter(9))]);
  });

  it('is over once a host of its source reports in, or the source is gone, and not once its hosts are forgotten', () => {
    const outage = raised();

    expect(
      outage.isOverWith({
        hosts: [aNamedHost('dev-host')],
        sourceExists: true,
        now: minutesAfter(10),
      }),
    ).toBe(false);
    expect(
      outage.isOverWith({
        hosts: [aNamedHost('dev-host', { lastAt: 10 })],
        sourceExists: true,
        now: minutesAfter(10),
      }),
    ).toBe(true);
    expect(
      outage.isOverWith({
        hosts: [],
        sourceExists: true,
        now: minutesAfter(60 * 25),
      }),
    ).toBe(false);
    expect(
      outage.isOverWith({
        hosts: [],
        sourceExists: false,
        now: minutesAfter(10),
      }),
    ).toBe(true);
  });
});

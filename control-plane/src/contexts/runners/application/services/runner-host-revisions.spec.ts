import { reviseHost } from '@runners/application/services/runner-host-revisions';
import {
  aHost,
  aHostReport,
  HOST_ID,
  heldHosts,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerHostMovedOnError } from '@runners/domain/exceptions/runner-host-moved-on.error';
import { describe, expect, it } from 'vitest';

const LATER = new Date(STARTED_AT.getTime() + 30_000);

const reported = (host: ReturnType<typeof aHost>) =>
  host.reportedThrough({
    admission: host.admission,
    workspaceId: host.workspaceId,
    session: host.session,
    report: aHostReport(['runner_1']),
    at: LATER,
  });

describe('reviseHost', () => {
  it('adds a host it has never seen', async () => {
    const { held, hosts } = heldHosts();

    await reviseHost(hosts, HOST_ID, (known) => known ?? aHost());

    expect(hosts.add).toHaveBeenCalledTimes(1);
    expect(hosts.save).not.toHaveBeenCalled();
    expect(held.get(HOST_ID.value)?.version).toBe(0);
  });

  it('saves a host it already knows over the version it read', async () => {
    const { held, hosts } = heldHosts(aHost());

    await reviseHost(hosts, HOST_ID, (known) => reported(known ?? aHost()));

    expect(hosts.save).toHaveBeenCalledTimes(1);
    expect(held.get(HOST_ID.value)?.version).toBe(1);
    expect(held.get(HOST_ID.value)?.lastSeenAt).toEqual(LATER);
  });

  it('writes nothing when a report leaves the host as it was', async () => {
    const { held, hosts } = heldHosts(aHost());

    await reviseHost(hosts, HOST_ID, (known) => known ?? aHost());

    expect(hosts.save).not.toHaveBeenCalled();
    expect(held.get(HOST_ID.value)?.version).toBe(0);
  });

  it('reads the host again and retries when another report moved it on first', async () => {
    const { held, hosts } = heldHosts();
    const seen: (number | null)[] = [];

    hosts.add.mockImplementationOnce(async (host) => {
      held.set(host.id.value, host);
      throw new RunnerHostMovedOnError(host.id.value);
    });

    const revised = await reviseHost(hosts, HOST_ID, (known) => {
      seen.push(known?.version ?? null);
      return known ? reported(known) : aHost();
    });

    expect(seen).toEqual([null, 0]);
    expect(revised.lastSeenAt).toEqual(LATER);
    expect(held.get(HOST_ID.value)?.version).toBe(1);
  });

  it('gives up after three tries, answering the host moved on', async () => {
    const { hosts } = heldHosts(aHost());

    hosts.save.mockImplementation(async (host) => {
      throw new RunnerHostMovedOnError(host.id.value);
    });

    await expect(
      reviseHost(hosts, HOST_ID, (known) => reported(known ?? aHost())),
    ).rejects.toThrow(RunnerHostMovedOnError);
    expect(hosts.find).toHaveBeenCalledTimes(3);
    expect(hosts.save).toHaveBeenCalledTimes(3);
  });

  it('never retries what is not the host having moved on', async () => {
    const { hosts } = heldHosts(aHost());
    const lost = new Error('the database is down');

    hosts.save.mockRejectedValue(lost);

    await expect(
      reviseHost(hosts, HOST_ID, (known) => reported(known ?? aHost())),
    ).rejects.toBe(lost);
    expect(hosts.save).toHaveBeenCalledTimes(1);
  });
});

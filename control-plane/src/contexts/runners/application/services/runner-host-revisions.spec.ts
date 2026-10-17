import { reviseHost } from '@runners/application/services/runner-host-revisions';
import {
  aHost,
  aHostReport,
  HOST_ID,
  STARTED_AT,
  storedHosts,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerHostVersionConflictError } from '@runners/domain/exceptions/runner-host-version-conflict.error';
import { describe, expect, it } from 'vitest';

const LATER = new Date(STARTED_AT.getTime() + 30_000);

const reported = (host: ReturnType<typeof aHost>) =>
  host.reportThrough({
    admission: host.admission,
    workspaceId: host.workspaceId,
    bootId: host.bootId,
    report: aHostReport(['runner_1']),
    at: LATER,
  });

describe('reviseHost', () => {
  it('adds a host it does not know yet', async () => {
    const { stored, hosts } = storedHosts();

    await reviseHost(hosts, HOST_ID, (known) => known ?? aHost());

    expect(hosts.add).toHaveBeenCalledTimes(1);
    expect(hosts.save).not.toHaveBeenCalled();
    expect(stored.get(HOST_ID.value)?.version).toBe(0);
  });

  it('saves a host it already knows over the version it read', async () => {
    const { stored, hosts } = storedHosts(aHost());

    await reviseHost(hosts, HOST_ID, (known) => reported(known ?? aHost()));

    expect(hosts.save).toHaveBeenCalledTimes(1);
    expect(stored.get(HOST_ID.value)?.version).toBe(1);
    expect(stored.get(HOST_ID.value)?.lastHeartbeatAt).toEqual(LATER);
  });

  it('writes nothing when a report leaves the host as it was', async () => {
    const { stored, hosts } = storedHosts(aHost());

    await reviseHost(hosts, HOST_ID, (known) => known ?? aHost());

    expect(hosts.save).not.toHaveBeenCalled();
    expect(stored.get(HOST_ID.value)?.version).toBe(0);
  });

  it('reads the host again and retries when another report moved it on first', async () => {
    const { stored, hosts } = storedHosts();
    const seen: (number | null)[] = [];

    hosts.add.mockImplementationOnce(async (host) => {
      stored.set(host.id.value, host);
      throw new RunnerHostVersionConflictError(host.id.value);
    });

    const revised = await reviseHost(hosts, HOST_ID, (known) => {
      seen.push(known?.version ?? null);
      return known ? reported(known) : aHost();
    });

    expect(seen).toEqual([null, 0]);
    expect(revised.lastHeartbeatAt).toEqual(LATER);
    expect(stored.get(HOST_ID.value)?.version).toBe(1);
  });

  it('stops after three tries, and reports that the host changed', async () => {
    const { hosts } = storedHosts(aHost());

    hosts.save.mockImplementation(async (host) => {
      throw new RunnerHostVersionConflictError(host.id.value);
    });

    await expect(
      reviseHost(hosts, HOST_ID, (known) => reported(known ?? aHost())),
    ).rejects.toThrow(RunnerHostVersionConflictError);
    expect(hosts.find).toHaveBeenCalledTimes(3);
    expect(hosts.save).toHaveBeenCalledTimes(3);
  });

  it('never retries what is not a version conflict on the host', async () => {
    const { hosts } = storedHosts(aHost());
    const lost = new Error('the database is down');

    hosts.save.mockRejectedValue(lost);

    await expect(
      reviseHost(hosts, HOST_ID, (known) => reported(known ?? aHost())),
    ).rejects.toBe(lost);
    expect(hosts.save).toHaveBeenCalledTimes(1);
  });
});

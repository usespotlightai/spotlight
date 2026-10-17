import { InvalidRunConnectionError } from '@work/domain/exceptions/invalid-run-connection.error';
import { RunConnection } from '@work/domain/value-objects/run-connection.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-16T12:00:00.000Z');

const parts = {
  host: 'Registry.NPMJS.org',
  port: 443,
  bytesOut: 512,
  bytesIn: 4_096,
  ms: 80,
  outcome: 'passthrough',
  status: null as number | null,
  reason: null as string | null,
  at: AT,
};

describe('RunConnection', () => {
  it('keeps a connection with its host in lower case', () => {
    expect(RunConnection.of(parts)).toMatchObject({
      host: 'registry.npmjs.org',
      port: 443,
      bytesOut: 512,
      bytesIn: 4_096,
      ms: 80,
      outcome: 'passthrough',
      at: AT,
    });
  });

  it('refuses a host, port, count, outcome or time it cannot keep', () => {
    for (const wrong of [
      { host: '' },
      { host: 'a'.repeat(254) },
      { host: 'evil host' },
      { port: 0 },
      { port: 70_000 },
      { bytesOut: -1 },
      { bytesIn: 1.5 },
      { ms: Number.NaN },
      { outcome: 'decrypted' },
      { outcome: 'injected', status: 99 },
      { outcome: 'injected', status: 600 },
      { outcome: 'injected', status: 200.5 },
      { at: new Date('not a time') },
    ]) {
      expect(() => RunConnection.of({ ...parts, ...wrong })).toThrow(
        InvalidRunConnectionError,
      );
    }
  });

  it('keeps a reason that fits its outcome', () => {
    expect(
      RunConnection.of({ ...parts, outcome: 'blocked', reason: 'not-bound' })
        .reason,
    ).toBe('not-bound');
    expect(
      RunConnection.of({ ...parts, outcome: 'failed', reason: 'timed-out' })
        .reason,
    ).toBe('timed-out');
  });

  it('refuses a status or a reason that does not fit its outcome', () => {
    for (const wrong of [
      { outcome: 'passthrough', status: 401 },
      { outcome: 'blocked', status: 403 },
      { outcome: 'failed', reason: 'cosmic-rays' },
      { outcome: 'blocked', reason: 'timed-out' },
      { outcome: 'failed', reason: 'not-allowed' },
      { outcome: 'injected', reason: 'unreachable' },
      { outcome: 'passthrough', reason: 'not-allowed' },
    ]) {
      expect(() => RunConnection.of({ ...parts, ...wrong })).toThrow(
        InvalidRunConnectionError,
      );
    }
  });

  it('has an error when it was blocked or failed, or when the host refused or failed an injected request', () => {
    const error = (part: Partial<typeof parts>) =>
      RunConnection.of({ ...parts, ...part }).error;

    expect(error({ outcome: 'blocked', reason: 'not-allowed' })).toBe(
      'blocked',
    );
    expect(error({ outcome: 'failed', reason: 'timed-out' })).toBe('failed');
    expect(error({ outcome: 'injected', status: 401 })).toBe('auth-failed');
    expect(error({ outcome: 'injected', status: 403 })).toBe('auth-failed');
    expect(error({ outcome: 'injected', status: 502 })).toBe('server-error');
    expect(error({ outcome: 'injected', status: 404 })).toBeNull();
    expect(error({ outcome: 'injected', status: 200 })).toBeNull();
    expect(error({ outcome: 'injected' })).toBeNull();
    expect(error({ outcome: 'passthrough' })).toBeNull();
    expect(
      RunConnection.of({ ...parts, outcome: 'failed', reason: null }).isError,
    ).toBe(true);
  });

  it('keeps the time egress tells only when it is near the time the record arrives', () => {
    const now = new Date('2026-10-16T13:00:00.000Z');

    expect(RunConnection.record(parts, now).at).toEqual(AT);
    for (const told of [
      new Date('2026-10-16T11:59:59.000Z'),
      new Date('2026-10-16T13:01:01.000Z'),
    ]) {
      expect(RunConnection.record({ ...parts, at: told }, now).at).toEqual(now);
    }
  });
});

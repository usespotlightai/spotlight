import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { HostSession } from '@runners/domain/value-objects/host-session.vo';
import { describe, expect, it } from 'vitest';

describe('HostSession', () => {
  it('keeps the session a host started, trimmed', () => {
    expect(HostSession.of('  K7Q2M4ZC3VYH6N5RB8WX1TDJ9P  ').value).toBe(
      'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    );
  });

  it.each(['', '   ', 'x'.repeat(65)])('rejects %j', (raw) => {
    expect(() => HostSession.of(raw)).toThrow(InvalidHostReportError);
  });

  it('is the same session only when the host has not restarted', () => {
    expect(
      HostSession.of('session_1').equals(HostSession.of('session_1')),
    ).toBe(true);
    expect(
      HostSession.of('session_1').equals(HostSession.of('session_2')),
    ).toBe(false);
  });
});

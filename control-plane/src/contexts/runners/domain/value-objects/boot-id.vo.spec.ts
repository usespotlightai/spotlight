import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { describe, expect, it } from 'vitest';

describe('BootId', () => {
  it('keeps the boot id a host started with, trimmed', () => {
    expect(BootId.of('  K7Q2M4ZC3VYH6N5RB8WX1TDJ9P  ').value).toBe(
      'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    );
  });

  it.each(['', '   ', 'x'.repeat(65)])('rejects %j', (raw) => {
    expect(() => BootId.of(raw)).toThrow(InvalidHostReportError);
  });

  it('is the same boot id only when the host has not restarted', () => {
    expect(BootId.of('boot_1').equals(BootId.of('boot_1'))).toBe(true);
    expect(BootId.of('boot_1').equals(BootId.of('boot_2'))).toBe(false);
  });
});

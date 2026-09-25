import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('HostId', () => {
  it('takes the name a host gives itself', () => {
    expect(HostId.of('host_A-0000000001').value).toBe('host_A-0000000001');
    expect(HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE').value).toBe(
      '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
    );
    expect(HostId.of('a'.repeat(64)).equals(HostId.of('a'.repeat(64)))).toBe(
      true,
    );
  });

  it('refuses a name too short, too long, or with characters beyond letters, digits, _ and -', () => {
    for (const raw of [
      'host-0001',
      'a'.repeat(15),
      'a'.repeat(65),
      'host 0000000000001',
      'host/000000000001',
      '',
    ]) {
      expect(() => HostId.of(raw)).toThrow(InvalidIdentifierError);
    }
  });
});

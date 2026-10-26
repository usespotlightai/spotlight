import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';
import { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { describe, expect, it } from 'vitest';

const MD5 = 'd41d8cd98f00b204e9800998ecf8427e';

const read = (text: string) =>
  StateSnapshot.read({ text, md5: MD5, size: text.length });

describe('StateSnapshot', () => {
  it('reads the serial and lineage of a state', () => {
    const snapshot = read(
      JSON.stringify({ version: 4, serial: 7, lineage: 'abc', resources: [] }),
    );

    expect(snapshot.serial).toBe(7);
    expect(snapshot.lineage).toBe('abc');
    expect(snapshot.size).toBeGreaterThan(0);
  });

  it.each([
    ['not JSON', 'nope'],
    ['an array', '[]'],
    ['no serial', JSON.stringify({ lineage: 'abc' })],
    ['a negative serial', JSON.stringify({ serial: -1, lineage: 'abc' })],
    ['no lineage', JSON.stringify({ serial: 1 })],
  ])('refuses %s', (_, text) => {
    expect(() => read(text)).toThrow(InvalidTerraformStateError);
  });

  it('refuses an MD5 that is not 32 hexadecimal digits', () => {
    expect(() =>
      StateSnapshot.of({ serial: 1, lineage: 'abc', md5: 'xyz', size: 1 }),
    ).toThrow(InvalidTerraformStateError);
  });
});

describe('StateLock', () => {
  const at = new Date('2026-10-26T10:00:00Z');

  it('keeps the lock info Terraform sent', () => {
    const info = { ID: 'a', Operation: 'OperationTypePlan', Who: 'me@laptop' };

    expect(
      StateLock.of({ info, lockedBy: 'person:u1', lockedAt: at }).info,
    ).toEqual(info);
  });

  it.each([
    ['not an object', 'a'],
    ['no ID', { Operation: 'OperationTypePlan' }],
    ['an empty ID', { ID: ' ' }],
  ])('refuses lock info with %s', (_, info) => {
    expect(() =>
      StateLock.of({ info, lockedBy: 'person:u1', lockedAt: at }),
    ).toThrow(InvalidTerraformStateError);
  });
});

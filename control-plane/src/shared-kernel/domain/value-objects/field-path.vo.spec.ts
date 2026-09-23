import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

describe('FieldPath', () => {
  it('reads a dotted path, taking bare numbers as positions', () => {
    expect(FieldPath.dotted('stations.2.check').segments).toEqual([
      'stations',
      2,
      'check',
    ]);
  });

  it('keeps a key that only looks like a number a key when given exactly', () => {
    expect(FieldPath.of(['responses', '200']).segments).toEqual([
      'responses',
      '200',
    ]);
  });

  it('is the whole document when it names nothing', () => {
    expect(FieldPath.dotted('  ').isRoot).toBe(true);
    expect(FieldPath.root().isRoot).toBe(true);
  });

  it('equals another naming the same fields', () => {
    expect(
      FieldPath.dotted('stations.2.check').equals(
        FieldPath.of(['stations', 2, 'check']),
      ),
    ).toBe(true);
    expect(
      FieldPath.of(['responses', '200']).equals(
        FieldPath.of(['responses', 200]),
      ),
    ).toBe(false);
  });
});

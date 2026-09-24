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

  it('is written the way the Terraform provider points at an attribute', () => {
    expect(FieldPath.of(['stations', 2, 'check']).rendered).toBe(
      'stations[2].check',
    );
    expect(FieldPath.root().rendered).toBe('');
  });

  it('quotes a key that is not a plain name', () => {
    expect(
      FieldPath.of(['egress', 'api.linear.app', 'headers', 0]).rendered,
    ).toBe('egress["api.linear.app"].headers[0]');
    expect(FieldPath.of(['on', 'task.opened', 'to', 'thread']).rendered).toBe(
      'on["task.opened"].to.thread',
    );
    expect(FieldPath.of(['responses', '200']).rendered).toBe(
      'responses["200"]',
    );
  });

  it('writes any index or key as a splat', () => {
    expect(FieldPath.of(['events', '*', 'when']).rendered).toBe(
      'events[*].when',
    );
  });

  it('reads back every path it writes', () => {
    for (const field of [
      FieldPath.of(['stations', 2, 'check']),
      FieldPath.of(['on', 'task.opened', 'to', 'thread']),
      FieldPath.of(['responses', '200', 'say "hi"']),
      FieldPath.of(['webhook', 'events', '*', 'when']),
    ]) {
      expect(FieldPath.parsed(field.rendered)).toEqual(field);
    }
  });

  it('reads nothing from what is not a path', () => {
    for (const written of ['', '.on', 'on..to', 'on[x]', 'on["open]', '0.on']) {
      expect(FieldPath.parsed(written)).toBeNull();
    }
  });
});

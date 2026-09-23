import { attributePath } from '@platform/http/field-paths';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

describe('attributePath', () => {
  it('names a field the way the Terraform provider points at an attribute', () => {
    expect(attributePath(FieldPath.of(['stations', 2, 'check']))).toBe(
      'stations[2].check',
    );
  });

  it('quotes a key that is not a plain name', () => {
    expect(
      attributePath(FieldPath.of(['egress', 'api.linear.app', 'headers', 0])),
    ).toBe('egress["api.linear.app"].headers[0]');
    expect(attributePath(FieldPath.of(['responses', '200']))).toBe(
      'responses["200"]',
    );
  });

  it('is empty for the whole resource', () => {
    expect(attributePath(FieldPath.root())).toBe('');
  });
});

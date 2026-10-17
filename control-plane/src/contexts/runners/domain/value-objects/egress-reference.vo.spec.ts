import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { describe, expect, it } from 'vitest';

describe('EgressReference', () => {
  it('reads spotlight as the platform egress', () => {
    const reference = EgressReference.of('spotlight');

    expect(reference.isPlatform).toBe(true);
    expect(reference.egressId).toBeNull();
    expect(reference.value).toBe('spotlight');
    expect(reference.equals(EgressReference.platform())).toBe(true);
  });

  it('reads anything else as the id of an egress', () => {
    const reference = EgressReference.of('egress_1');

    expect(reference.isPlatform).toBe(false);
    expect(reference.egressId?.equals(EgressId.of('egress_1'))).toBe(true);
    expect(reference.equals(EgressReference.platform())).toBe(false);
    expect(reference.equals(EgressReference.to(EgressId.of('egress_1')))).toBe(
      true,
    );
  });

  it('refuses an empty reference', () => {
    expect(() => EgressReference.of(' ')).toThrow();
  });
});

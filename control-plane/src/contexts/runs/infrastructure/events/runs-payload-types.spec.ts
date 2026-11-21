import { RUNS_PAYLOAD_TYPES } from '@runs/infrastructure/events/runs-payload-types';
import { SECRET } from '@shared-kernel/domain/value-objects/secret';
import { describe, expect, it } from 'vitest';

describe('RUNS_PAYLOAD_TYPES', () => {
  it('contains no secret, which must never travel in an event', () => {
    expect(
      RUNS_PAYLOAD_TYPES.filter((type) => SECRET in type.prototype).map(
        (type) => type.name,
      ),
    ).toEqual([]);
  });
});

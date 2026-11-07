import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { describe, expect, it } from 'vitest';

describe('LineKey', () => {
  it('orders by code point, the same on every machine', () => {
    const keys = ['review', 'a-b', 'ab', 'delivery'].map((each) =>
      LineKey.of(each),
    );

    expect(
      [...keys]
        .sort((one, other) => one.compare(other))
        .map((each) => each.value),
    ).toEqual(['a-b', 'ab', 'delivery', 'review']);
    expect(LineKey.of('ab').compare(LineKey.of('ab'))).toBe(0);
  });
});

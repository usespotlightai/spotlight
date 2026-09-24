import {
  inCodePointOrder,
  inCodePointOrderOf,
} from '@platform/ordering/code-point-order';
import { describe, expect, it } from 'vitest';

describe('inCodePointOrder', () => {
  it('orders text by code point, whatever the locale', () => {
    expect(['b', 'B', 'a', '_', 'ä', '1'].sort(inCodePointOrder)).toEqual([
      '1',
      'B',
      '_',
      'a',
      'b',
      'ä',
    ]);
  });

  it('orders a character beyond the basic plane after every character within it', () => {
    expect(
      ['\u{1F600}', '\uFF01', 'ab', 'a', ''].sort(inCodePointOrder),
    ).toEqual(['', 'a', 'ab', '\uFF01', '\u{1F600}']);
  });

  it('orders things by the text a key reads from them', () => {
    expect(
      [{ key: 'ops' }, { key: 'core' }].sort(
        inCodePointOrderOf((each) => each.key),
      ),
    ).toEqual([{ key: 'core' }, { key: 'ops' }]);
  });
});

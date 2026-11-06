import { describe, expect, it } from 'vitest';
import { keptOpen, oneLineOf } from '@/lib/turns';

describe('keptOpen', () => {
  it('keeps the newest turn, the newest with content and the ones that hold something', () => {
    expect(
      keptOpen([
        { filled: true, holds: false },
        { filled: true, holds: true },
        { filled: true, holds: false },
        { filled: true, holds: false },
        { filled: false, holds: false },
      ]),
    ).toEqual([false, true, false, true, true]);
  });
});

describe('oneLineOf', () => {
  it('puts markdown on one plain line', () => {
    expect(oneLineOf('# Plan\n\n- **Read** `src/queue.ts`\n> done')).toBe(
      'Plan - Read src/queue.ts done',
    );
  });

  it('cuts a long text short', () => {
    expect(oneLineOf('word '.repeat(200)).length).toBe(240);
  });
});

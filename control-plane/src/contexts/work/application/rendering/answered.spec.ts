import { Answered } from '@work/application/rendering/answered';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, size: number) => ({
  id,
  path: `api/${id}.ts`,
  index: 0,
  header: '@@ -1 +1 @@',
  lines: [`+${'x'.repeat(size)}`],
});

describe('Answered', () => {
  it('hands over the accepted change as whole hunks, saying how many it left out', () => {
    const told = Answered.accepted([
      hunk('a', 40_000),
      hunk('b', 30_000),
      hunk('c', 10),
    ]);

    expect(told).toContain('--- api/a.ts');
    expect(told).not.toContain('--- api/b.ts');
    expect(told).toContain('… 2 more hunks');
    expect(told?.endsWith('```')).toBe(true);
  });

  it('quotes what a person said when they sent the run back', () => {
    expect(Answered.sentBack(['Retry with backoff.\nLog it.'])).toContain(
      '> Retry with backoff.\n> Log it.',
    );
  });

  it('hands over nothing when there is no change or feedback', () => {
    expect(Answered.accepted([])).toBeNull();
    expect(Answered.sentBack([])).toBeNull();
  });
});

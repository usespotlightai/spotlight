import { hunksOf } from '@work/domain/services/change-hunks';
import { describe, expect, it } from 'vitest';

const numbered = (count: number, change: Record<number, string> = {}) =>
  Array.from(
    { length: count },
    (_, at) => change[at + 1] ?? `line ${at + 1}`,
  ).join('\n');

describe('hunksOf', () => {
  it('finds nothing where a file did not change', () => {
    expect(hunksOf('api/a.ts', 'same\n', 'same\n')).toEqual([]);
  });

  it('cuts one hunk around a changed line, with three lines of context', () => {
    const [hunk, ...rest] = hunksOf(
      'api/a.ts',
      numbered(10),
      numbered(10, { 5: 'five' }),
    );

    expect(rest).toEqual([]);
    expect(hunk).toEqual({
      id: 'api/a.ts#1',
      path: 'api/a.ts',
      index: 1,
      header: '@@ -2,7 +2,7 @@',
      lines: [
        ' line 2',
        ' line 3',
        ' line 4',
        '-line 5',
        '+five',
        ' line 6',
        ' line 7',
        ' line 8',
      ],
    });
  });

  it('numbers hunks far apart in the order they come', () => {
    const hunks = hunksOf(
      'api/a.ts',
      numbered(40),
      numbered(40, { 3: 'three', 30: 'thirty' }),
    );

    expect(hunks.map((each) => each.id)).toEqual(['api/a.ts#1', 'api/a.ts#2']);
    expect(hunks.map((each) => each.header)).toEqual([
      '@@ -1,6 +1,6 @@',
      '@@ -27,7 +27,7 @@',
    ]);
  });

  it('keeps changes close together in one hunk', () => {
    expect(
      hunksOf('api/a.ts', numbered(20), numbered(20, { 5: 'a', 9: 'b' })),
    ).toHaveLength(1);
  });

  it('reads a new file as lines added', () => {
    expect(hunksOf('api/new.ts', '', 'one\ntwo\n')).toEqual([
      {
        id: 'api/new.ts#1',
        path: 'api/new.ts',
        index: 1,
        header: '@@ -0,0 +1,2 @@',
        lines: ['+one', '+two'],
      },
    ]);
  });

  it('finds lines inserted between others', () => {
    const [hunk] = hunksOf('api/a.ts', 'a\nb\nc\n', 'a\nb\nnew\nc\n');

    expect(hunk?.lines).toEqual([' a', ' b', '+new', ' c']);
    expect(hunk?.header).toBe('@@ -1,3 +1,4 @@');
  });
});

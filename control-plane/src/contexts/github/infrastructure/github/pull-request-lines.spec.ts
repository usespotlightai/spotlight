import { PullRequestLines } from '@github/infrastructure/github/pull-request-lines';
import { describe, expect, it } from 'vitest';

const PATCH = [
  '@@ -10,4 +10,5 @@ function cmdDone(args, filePath) {',
  '   const id = parseInt(args[0], 10);',
  '-  const tasks = loadTasks(filePath);',
  '+  const tasks = loadTasks(filePath) ?? [];',
  '+  const task = tasks.find(t => t.id === id);',
  '   if (!task) {',
  '     process.exit(1);',
].join('\n');

const lines = PullRequestLines.of([
  { filename: 'backend/todo.js', patch: PATCH },
  { filename: 'logo.png' },
]);

const on = (
  line: number,
  over: { path?: string; side?: 'new' | 'old'; startLine?: number } = {},
) => ({
  path: over.path ?? 'backend/todo.js',
  side: over.side ?? 'new',
  line,
  startLine: over.startLine ?? null,
  body: 'About this',
});

describe('PullRequestLines', () => {
  it('places a comment on a line the pull request adds, or leaves as it was', () => {
    expect(lines.places(on(11))).toBe(true);
    expect(lines.places(on(12))).toBe(true);
    expect(lines.places(on(10))).toBe(true);
    expect(lines.places(on(14))).toBe(true);
  });

  it('places a comment on a line the pull request removes, on the old side', () => {
    expect(lines.places(on(11, { side: 'old' }))).toBe(true);
    expect(lines.places(on(15, { side: 'old' }))).toBe(false);
  });

  it('places no comment outside what the pull request shows', () => {
    expect(lines.places(on(40))).toBe(false);
    expect(lines.places(on(3))).toBe(false);
    expect(lines.places(on(11, { path: 'backend/tests/todo.test.js' }))).toBe(
      false,
    );
    expect(lines.places(on(1, { path: 'logo.png' }))).toBe(false);
  });

  it('places a comment on several lines only where both ends are shown', () => {
    expect(lines.places(on(12, { startLine: 10 }))).toBe(true);
    expect(lines.places(on(40, { startLine: 12 }))).toBe(false);
  });
});

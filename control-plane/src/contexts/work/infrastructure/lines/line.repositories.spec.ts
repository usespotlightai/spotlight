import { compileLine } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it } from 'vitest';

const STATIONS = [
  { key: 'backlog', name: 'Backlog', kind: 'backlog' },
  { key: 'build', name: 'Build', harness: 'dev' },
  { key: 'completed', name: 'Completed', kind: 'completed' },
];

const compiled = (repositories?: readonly string[]) =>
  compileLine({
    key: 'delivery',
    name: 'Delivery',
    ...(repositories ? { repositories } : {}),
    stations: STATIONS,
  });

describe('the repositories a line works', () => {
  it('reads each one it names', () => {
    const read = compiled(['acme/api', 'acme/web']);

    if (!read.ok) {
      throw new Error(read.problems.map((each) => each.reason).join(', '));
    }

    expect(read.line.repositories.map((each) => each.value)).toEqual([
      'acme/api',
      'acme/web',
    ]);
  });

  it('reads a line that names none', () => {
    const read = compiled();

    if (!read.ok) {
      throw new Error(read.problems.map((each) => each.reason).join(', '));
    }

    expect(read.line.repositories).toEqual([]);
  });

  it('refuses one that is not named owner/name', () => {
    const read = compiled(['not-a-repo']);

    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.problems[0]?.at).toBe('repositories.0');
    }
  });

  it('refuses two repositories that share a name', () => {
    const read = compiled(['acme/api', 'other/api']);

    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.problems[0]?.reason).toContain('api');
    }
  });
});

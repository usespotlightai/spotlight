import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { compileLine } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it } from 'vitest';

const STATIONS = [
  { key: 'backlog', name: 'Backlog', kind: 'backlog' },
  { key: 'build', name: 'Build', harness: 'dev' },
  { key: 'completed', name: 'Completed', kind: 'completed' },
];

const CHECKING_STATIONS = [
  STATIONS[0],
  {
    key: 'build',
    name: 'Build',
    harness: 'dev',
    check: 'npm test',
    diffs: true,
  },
  STATIONS[2],
];

type Named = { name: string; image?: string; setup?: string };

const compiled = (
  repositories?: readonly (string | Named)[],
  stations: readonly unknown[] = STATIONS,
) =>
  compileLine({
    key: 'delivery',
    name: 'Delivery',
    ...(repositories
      ? {
          repositories: repositories.map((each) =>
            typeof each === 'string' ? { name: each } : each,
          ),
        }
      : {}),
    stations,
  });

const read = (...args: Parameters<typeof compiled>) => {
  const held = compiled(...args);

  if (!held.ok) {
    throw new Error(held.problems.map((each) => each.reason).join(', '));
  }

  return held.line;
};

const refusedAt = (...args: Parameters<typeof compiled>) => {
  const held = compiled(...args);

  if (held.ok) {
    throw new Error('was not refused');
  }

  return held.problems.map((each) => dottedOf(each.field));
};

const DIGEST = `sha256:${'c'.repeat(64)}`;

describe('the repositories a line works', () => {
  it('reads each one it names', () => {
    expect(
      read(['acme/api', 'acme/web']).repositories.all.map((each) => each.value),
    ).toEqual(['acme/api', 'acme/web']);
  });

  it('reads a line that names none', () => {
    expect(read().repositories.isEmpty).toBe(true);
  });

  it('reads the image a repository is worked in and how its checkout is made ready', () => {
    const line = read([
      {
        name: 'acme/api',
        image: `ghcr.io/acme/api@${DIGEST}`,
        setup: 'npm ci',
      },
      { name: 'acme/web' },
    ]);

    expect(line.repositories.image?.value).toBe(`ghcr.io/acme/api@${DIGEST}`);
    expect(line.repositories.entries[0]?.setup?.value).toBe('npm ci');
    expect(line.repositories.entries[1]?.image).toBeNull();
    expect(line.repositories.entries[1]?.setup).toBeNull();
  });

  it('refuses one that is not named owner/name', () => {
    expect(refusedAt(['not-a-repo'])).toEqual(['repositories.0.name']);
  });

  it('refuses an image that is no image reference, where the line names it', () => {
    expect(
      refusedAt(['acme/api', { name: 'acme/web', image: 'Not An Image' }]),
    ).toEqual(['repositories.1.image']);
  });

  it('refuses a setup of more than one line, where the line names it', () => {
    expect(
      refusedAt([{ name: 'acme/api', setup: 'npm ci\nnpm run build' }]),
    ).toEqual(['repositories.0.setup']);
  });

  it('refuses two repositories that share a name', () => {
    const held = compiled(['acme/api', 'other/api']);

    expect(held.ok).toBe(false);
    if (!held.ok) {
      expect(held.problems[0]?.reason).toContain('api');
    }
  });

  it('refuses repositories naming different images', () => {
    expect(
      refusedAt([
        { name: 'acme/api', image: 'ghcr.io/acme/api:1' },
        { name: 'acme/web', image: 'ghcr.io/acme/web:1' },
      ]),
    ).toEqual(['repositories']);
  });

  it('refuses, where a station checks its layers, a repository that does not say how its checkout is made ready', () => {
    expect(
      refusedAt(
        [{ name: 'acme/api', setup: 'npm ci' }, { name: 'acme/web' }],
        CHECKING_STATIONS,
      ),
    ).toEqual(['repositories.1.setup']);
  });

  it('reads a line whose checking station works only repositories that say how they are made ready', () => {
    expect(
      read([{ name: 'acme/api', setup: 'npm ci' }], CHECKING_STATIONS)
        .repositories.all,
    ).toHaveLength(1);
  });
});

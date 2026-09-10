import { compileLine } from '@infrastructure/integrations/line.compile';
import { describe, expect, it } from 'vitest';

/**
 * A line names the repositories a run on it works in. They are cloned into the
 * workspace side by side, so each has to name a distinct directory, and each
 * has to be a repository at all.
 */
const LINE = (repositories: string) => `
version: 1
key: delivery
name: Software Delivery
repositories:
${repositories}
stations:
  - key: backlog
    name: Backlog
    kind: backlog
  - key: build
    name: Build
    harness: dev
  - key: done
    name: Done
    kind: completed
`;

const compiled = (repositories: string) =>
  compileLine('.spotlight/lines/delivery.yml', LINE(repositories));

describe('the repositories a line works', () => {
  it('reads each one it names', () => {
    const read = compiled('  - acme/api\n  - acme/web');

    if (!read.ok) {
      throw new Error(read.problems.map((each) => each.reason).join(', '));
    }

    expect(read.line.repositories.map((each) => each.value)).toEqual([
      'acme/api',
      'acme/web',
    ]);
  });

  it('reads a line that names none', () => {
    const read = compileLine(
      '.spotlight/lines/delivery.yml',
      `
version: 1
key: delivery
name: Software Delivery
stations:
  - key: backlog
    name: Backlog
    kind: backlog
  - key: done
    name: Done
    kind: completed
`,
    );

    if (!read.ok) {
      throw new Error(read.problems.map((each) => each.reason).join(', '));
    }

    expect(read.line.repositories).toEqual([]);
  });

  it('refuses one that is not named owner/name', () => {
    const read = compiled('  - not-a-repo');

    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.problems[0]?.at).toBe('repositories.0');
    }
  });

  // The name is the directory each is cloned into, so two of one name collide.
  it('refuses two repositories that share a name', () => {
    const read = compiled('  - acme/api\n  - other/api');

    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.problems[0]?.reason).toContain('api');
    }
  });
});

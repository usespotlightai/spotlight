import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { compileLine } from '@infrastructure/integrations/line.compile';
import { describe, expect, it } from 'vitest';

const STATIONS = [
  ConfigurationFile.of(
    '.spotlight/lines/delivery/stations/backlog.md',
    '---\nname: Backlog\nkind: backlog\n---\n',
  ),
  ConfigurationFile.of(
    '.spotlight/lines/delivery/stations/build.md',
    '---\nname: Build\nharness: dev\n---\n',
  ),
  ConfigurationFile.of(
    '.spotlight/lines/delivery/stations/completed.md',
    '---\nname: Completed\nkind: completed\n---\n',
  ),
];

const LINE = (repositories: string) => `
version: 1
name: Delivery
repositories:
${repositories}
stations: [backlog, build, completed]
`;

const compiled = (repositories: string) =>
  compileLine('delivery', [
    ConfigurationFile.of(
      '.spotlight/lines/delivery/line.yml',
      LINE(repositories),
    ),
    ...STATIONS,
  ]);

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
    const read = compileLine('delivery', [
      ConfigurationFile.of(
        '.spotlight/lines/delivery/line.yml',
        'version: 1\nname: Delivery\nstations: [backlog, build, completed]\n',
      ),
      ...STATIONS,
    ]);

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

  it('refuses two repositories that share a name', () => {
    const read = compiled('  - acme/api\n  - other/api');

    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.problems[0]?.reason).toContain('api');
    }
  });
});

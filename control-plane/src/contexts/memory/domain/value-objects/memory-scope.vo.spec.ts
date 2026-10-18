import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { TouchedContext } from '@memory/domain/value-objects/run-context';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const touchedContext = (touched: string[] = []): TouchedContext => ({
  teamId: TEAM,
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [API],
  touched: touched.map((path) => ({
    repository: API,
    path: MemoryPath.of(path),
  })),
});

const aboutPaths = (paths: string[]) =>
  MemoryScope.of({
    teamId: TEAM,
    repository: API,
    paths: paths.map(MemoryPath.of),
  });

describe('MemoryScope', () => {
  it('matches a run context through a folder that contains a touched file', () => {
    expect(
      aboutPaths(['src/uploads']).matches(
        touchedContext(['src/uploads/retry.ts']),
      ),
    ).toBe(true);
    expect(
      aboutPaths(['src/uploads/retry.ts']).matches(
        touchedContext(['src/uploads/retry.ts']),
      ),
    ).toBe(true);
  });

  it('never matches through a path that only begins the same way', () => {
    expect(
      aboutPaths(['src/uploads']).matches(
        touchedContext(['src/uploadsX/a.ts']),
      ),
    ).toBe(false);
  });

  it('never matches a run context that touched nothing it is about', () => {
    expect(aboutPaths(['src/uploads']).matches(touchedContext())).toBe(false);
  });

  it('ranks paths, then a station, then a line, then a repository, then the team', () => {
    const specificity = [
      aboutPaths(['src']),
      MemoryScope.of({
        teamId: TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
      }),
      MemoryScope.of({ teamId: TEAM, lineId: 'line_1' }),
      MemoryScope.of({ teamId: TEAM, repository: API }),
      MemoryScope.of({ teamId: TEAM }),
    ].map((each) => each.specificity);

    expect(specificity).toEqual([4, 3, 2, 1, 0]);
  });
});

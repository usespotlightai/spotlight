import { Station } from '@domain/entities/station.entity';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const station = (kind: 'work' | 'backlog' = 'work') =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('implementation'),
    name: StationName.of('Implementation'),
    position: 1,
    color: StationColor.of('#93a1b5'),
    kind,
    skills: [SkillKey.of('our-migrations')],
  });

const named = (each: Station) => each.skills.map((skill) => skill.value);

describe('the skills a station gives its runs', () => {
  it('are kept through any other change to the station', () => {
    expect(named(station().rename(StationName.of('Build')))).toEqual([
      'our-migrations',
    ]);
    expect(named(station('backlog').rename(StationName.of('Inbox')))).toEqual([
      'our-migrations',
    ]);
  });

  it('are what the station is given, replacing what it had', () => {
    expect(
      named(station().givesSkills([SkillKey.of('frontend-hygiene')])),
    ).toEqual(['frontend-hygiene']);
  });

  it('are none for a station told none', () => {
    expect(
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('code-review'),
        name: StationName.of('Code Review'),
        position: 2,
        color: StationColor.of('#93a1b5'),
      }).skills,
    ).toEqual([]);
  });
});

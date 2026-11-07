import { Station } from '@lines/domain/entities/station.entity';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
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

describe('the skills a station enables for its runs', () => {
  it('are what the station is told, whatever its kind', () => {
    expect(named(station())).toEqual(['our-migrations']);
    expect(named(station('backlog'))).toEqual(['our-migrations']);
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

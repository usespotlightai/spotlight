import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { compileLine } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it } from 'vitest';

const LINE = (skills: readonly string[]) =>
  compileLine({
    key: 'delivery',
    name: 'Delivery',
    stations: [
      {
        key: 'backlog',
        name: 'Backlog',
        kind: 'backlog',
        passesTo: ['implementation'],
      },
      {
        key: 'implementation',
        name: 'Implementation',
        harness: 'claude-code',
        tools: ['pull-request'],
        skills,
      },
      { key: 'completed', name: 'Completed', kind: 'completed' },
    ],
  });

describe('the skills a station definition gives a station', () => {
  it('are read as the skills laid for a run there', () => {
    const read = LINE(['our-migrations', 'frontend-hygiene']);

    expect(read.ok).toBe(true);
    expect(
      read.ok && read.line.stations[1]?.skills?.map((each) => each.value),
    ).toEqual(['our-migrations', 'frontend-hygiene']);
  });

  it('are none where a station names none', () => {
    const read = LINE([]);

    expect(read.ok && read.line.stations[0]?.skills).toEqual([]);
  });

  it('rejects a skill named unlike a folder of skills, where it is written', () => {
    const read = LINE(['Our Migrations']);

    expect(read.ok).toBe(false);
    expect(!read.ok && read.problems[0]).toMatchObject({
      path: 'lines/delivery',
      field: FieldPath.dotted('stations.1.skills.0'),
    });
  });
});

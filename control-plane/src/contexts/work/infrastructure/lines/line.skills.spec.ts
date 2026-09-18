import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { compileLine } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it } from 'vitest';

const LINE = (skills: string) =>
  compileLine('delivery', [
    ConfigurationFile.of(
      '.spotlight/lines/delivery/line.yml',
      'version: 1\nname: Delivery\nstations: [backlog, implementation, completed]\n',
    ),
    ConfigurationFile.of(
      '.spotlight/lines/delivery/stations/backlog.md',
      '---\nname: Backlog\nkind: backlog\npassesTo: [implementation]\n---\n',
    ),
    ConfigurationFile.of(
      '.spotlight/lines/delivery/stations/implementation.md',
      `---\nname: Implementation\nharness: claude-code\ntools: [pull-request]\nskills: ${skills}\n---\n`,
    ),
    ConfigurationFile.of(
      '.spotlight/lines/delivery/stations/completed.md',
      '---\nname: Completed\nkind: completed\n---\n',
    ),
  ]);

describe('the skills a station file gives a station', () => {
  it('are read as the skills laid for a run there', () => {
    const read = LINE('[our-migrations, frontend-hygiene]');

    expect(read.ok).toBe(true);
    expect(
      read.ok && read.line.stations[1]?.skills?.map((each) => each.value),
    ).toEqual(['our-migrations', 'frontend-hygiene']);
  });

  it('are none where a station names none', () => {
    const read = LINE('[]');

    expect(read.ok && read.line.stations[0]?.skills).toEqual([]);
  });

  it('refuses a skill named unlike a folder of skills, where it is written', () => {
    const read = LINE('[Our Migrations]');

    expect(read.ok).toBe(false);
    expect(!read.ok && read.problems[0]).toMatchObject({
      path: '.spotlight/lines/delivery/stations/implementation.md',
      at: 'skills.0',
    });
  });
});

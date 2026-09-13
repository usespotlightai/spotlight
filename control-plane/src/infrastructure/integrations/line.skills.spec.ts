import { compileLine } from '@infrastructure/integrations/line.compile';
import { describe, expect, it } from 'vitest';

const PATH = '.spotlight/lines/delivery.yml';

const LINE = (skills: string) => `version: 1
key: delivery
name: Delivery
stations:
  - key: backlog
    name: Backlog
    kind: backlog
    passesTo: [implementation]
  - key: implementation
    name: Implementation
    harness: claude-code
    tools: [pull-request]
    skills: ${skills}
  - key: completed
    name: Completed
    kind: completed
`;

describe('the skills a line file gives a station', () => {
  it('are read as the skills laid for a run there', () => {
    const read = compileLine(PATH, LINE('[our-migrations, frontend-hygiene]'));

    expect(read.ok).toBe(true);
    expect(
      read.ok && read.line.stations[1]?.skills?.map((each) => each.value),
    ).toEqual(['our-migrations', 'frontend-hygiene']);
  });

  it('are none where a station names none', () => {
    const read = compileLine(PATH, LINE('[]'));

    expect(read.ok && read.line.stations[0]?.skills).toEqual([]);
  });

  it('refuses a skill named unlike a folder of skills, where it is written', () => {
    const read = compileLine(PATH, LINE('[Our Migrations]'));

    expect(read.ok).toBe(false);
    expect(!read.ok && read.problems.map((each) => each.at)).toContain(
      'stations.1.skills.0',
    );
  });
});

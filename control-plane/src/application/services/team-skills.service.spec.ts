import type {
  SkillFolder,
  SkillReaderPort,
} from '@application/ports/skill-reader.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import { TeamSkills } from '@application/services/team-skills.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { Skill } from '@domain/entities/skill.entity';
import { Station } from '@domain/entities/station.entity';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const GRAFANA: SkillFolder = {
  skill: Skill.defined({
    key: SkillKey.of('grafana-dashboards'),
    description: 'Reading this team’s dashboards.',
    instructions: 'Find one with spotlight grafana search.',
    secrets: [
      {
        name: SecretName.of('GRAFANA_TOKEN'),
        description: 'Read-only token its tools use',
      },
    ],
    tools: [Tool.of('grafana.search')],
  }),
  files: [{ path: 'SKILL.md', text: '---\nname: grafana-dashboards\n---\n' }],
};

const MIGRATIONS: SkillFolder = {
  skill: Skill.defined({
    key: SkillKey.of('our-migrations'),
    description: 'Writing a migration here.',
    instructions: 'Generate it; never write the SQL.',
  }),
  files: [
    { path: 'SKILL.md', text: '---\nname: our-migrations\n---\n' },
    { path: 'examples/add-column.md', text: 'Add it.' },
  ],
};

const FRONTEND: SkillFolder = {
  skill: Skill.defined({
    key: SkillKey.of('frontend'),
    description: 'Working on the web app.',
    instructions: 'Keep components small.',
  }),
  files: [{ path: 'SKILL.md', text: '---\nname: frontend\n---\n' }],
};

const line = { factoryId: 'factory_1' } as unknown as Line;

const naming = (...skills: string[]) =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('implementation'),
    name: StationName.of('Implementation'),
    position: 1,
    color: StationColor.of('#a3a8b0'),
    skills: skills.map((each) => SkillKey.of(each)),
  });

const keeping = (
  folders: readonly SkillFolder[],
  held: readonly string[] = [],
  over: { configured?: boolean } = {},
) => {
  const secrets = {
    held: vi.fn(async () => held.map((each) => SecretName.of(each))),
    resolveAll: vi.fn(async () => ({})),
  } satisfies TeamSecretsPort;
  const reader: SkillReaderPort = {
    read: () => ({ skills: folders, problems: [] }),
  };

  return new TeamSkills(
    {
      find: vi.fn(async () => ({ teamId: TEAM })),
    } as unknown as FactoryRepository,
    {
      findFor: vi.fn(async () =>
        over.configured === false
          ? null
          : TeamConfiguration.read({
              teamId: TEAM,
              repository: Repository.of('acme/config'),
              commit: Commit.of('a1b2c3d'),
              files: [],
              readAt: new Date('2026-09-13T08:00:00.000Z'),
            }),
      ),
    } as unknown as TeamConfigurationRepository,
    reader,
    secrets,
  );
};

const keysOf = (folders: readonly SkillFolder[]) =>
  folders.map((each) => each.skill.key.value);

describe('TeamSkills', () => {
  it('gives a run each skill the station names whose secrets the vault holds', async () => {
    const skills = keeping([GRAFANA, FRONTEND], ['GRAFANA_TOKEN']);

    const ready = await skills.readyAt(line, naming('grafana-dashboards'));

    expect(keysOf(ready)).toEqual(['grafana-dashboards']);
  });

  it('gives each skill whole, with every file of its folder', async () => {
    const skills = keeping([MIGRATIONS]);

    const ready = await skills.readyAt(line, naming('our-migrations'));

    expect(ready[0]?.files.map((each) => each.path)).toEqual([
      'SKILL.md',
      'examples/add-column.md',
    ]);
  });

  it('leaves out a skill that still needs a secret', async () => {
    const skills = keeping([GRAFANA, MIGRATIONS]);

    const ready = await skills.readyAt(
      line,
      naming('grafana-dashboards', 'our-migrations'),
    );

    expect(keysOf(ready)).toEqual(['our-migrations']);
  });

  it('gives nothing at a station that names no skill', async () => {
    const skills = keeping([MIGRATIONS, FRONTEND]);

    await expect(skills.readyAt(line, naming())).resolves.toEqual([]);
  });

  it('gives nothing where the team has read no configuration', async () => {
    const skills = keeping([MIGRATIONS], [], { configured: false });

    await expect(
      skills.readyAt(line, naming('our-migrations')),
    ).resolves.toEqual([]);
  });
});

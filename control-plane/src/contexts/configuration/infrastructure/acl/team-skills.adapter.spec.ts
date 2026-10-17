import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import type {
  SkillFolder,
  SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import { TeamSkills } from '@configuration/infrastructure/acl/team-skills.adapter';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const GRAFANA: SkillFolder = {
  skill: Skill.define({
    key: SkillKey.of('grafana-dashboards'),
    description: 'Reading this team’s dashboards.',
    instructions: 'Find one with spotlight grafana search.',
    secrets: [
      {
        name: SecretName.of('GRAFANA_TOKEN'),
        description: 'Read-only token its tools use',
      },
    ],
    tools: [ToolName.of('grafana.search')],
  }),
  files: [{ path: 'SKILL.md', text: '---\nname: grafana-dashboards\n---\n' }],
};

const MIGRATIONS: SkillFolder = {
  skill: Skill.define({
    key: SkillKey.of('our-migrations'),
    description: 'Writing a migration here.',
    instructions: 'Generate it; never write the SQL.',
    secrets: [],
    tools: [],
  }),
  files: [
    { path: 'SKILL.md', text: '---\nname: our-migrations\n---\n' },
    { path: 'examples/add-column.md', text: 'Add it.' },
  ],
};

const FRONTEND: SkillFolder = {
  skill: Skill.define({
    key: SkillKey.of('frontend'),
    description: 'Working on the web app.',
    instructions: 'Keep components small.',
    secrets: [],
    tools: [],
  }),
  files: [{ path: 'SKILL.md', text: '---\nname: frontend\n---\n' }],
};

const naming = (...skills: string[]) => skills;

const keeping = (
  folders: readonly SkillFolder[],
  existing: readonly string[] = [],
) => {
  const secrets = {
    ofTeam: vi.fn(async () => existing.map((each) => SecretName.of(each))),
  } satisfies SecretNamesPort;
  const reader: SkillReaderPort = {
    read: () => ({ skills: folders, problems: [] }),
    folder: vi.fn(),
  };

  return new TeamSkills(
    {
      of: vi.fn(async () => ({ teamId: TEAM, skills: [] })),
    } satisfies AppliedConfigurationPort,
    reader,
    secrets,
  );
};

const keysOf = (folders: readonly ReadySkillFolder[]) =>
  folders.map((each) => each.skill.key);

describe('TeamSkills', () => {
  it('gives a run each skill the station names whose secrets the team has', async () => {
    const skills = keeping([GRAFANA, FRONTEND], ['GRAFANA_TOKEN']);

    const ready = await skills.readyFor(TEAM, naming('grafana-dashboards'));

    expect(keysOf(ready)).toEqual(['grafana-dashboards']);
  });

  it('gives each skill whole, with every file of its folder', async () => {
    const skills = keeping([MIGRATIONS]);

    const ready = await skills.readyFor(TEAM, naming('our-migrations'));

    expect(ready[0]?.files.map((each) => each.path)).toEqual([
      'SKILL.md',
      'examples/add-column.md',
    ]);
  });

  it('leaves out a skill that needs a secret the team does not have', async () => {
    const skills = keeping([GRAFANA, MIGRATIONS]);

    const ready = await skills.readyFor(
      TEAM,
      naming('grafana-dashboards', 'our-migrations'),
    );

    expect(keysOf(ready)).toEqual(['our-migrations']);
  });

  it('names every skill the team defines, whether or not the team has its secrets', async () => {
    const skills = keeping([GRAFANA, MIGRATIONS]);

    expect(await skills.definedFor(TEAM)).toEqual([
      'grafana-dashboards',
      'our-migrations',
    ]);
  });

  it('gives nothing where no skill is named', async () => {
    const skills = keeping([MIGRATIONS, FRONTEND]);

    await expect(skills.readyFor(TEAM, naming())).resolves.toEqual([]);
  });
});

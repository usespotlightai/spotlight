import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type {
  SkillFolder,
  SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import { TeamSkillsHandler } from '@configuration/application/queries/handlers/team-skills.handler';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const GRAFANA: SkillFolder = {
  skill: Skill.defined({
    key: SkillKey.of('grafana-dashboards'),
    description: 'Reading this team’s dashboards.',
    instructions: 'Dashboards are at https://grafana.acme.dev.',
  }),
  files: [
    {
      path: 'SKILL.md',
      text: '---\nname: grafana-dashboards\n---\n',
    },
  ],
};

const listing = (teamId = 'team_1') =>
  new TeamSkillsHandler(
    {
      viewedBy: vi.fn(async (asked: string) =>
        asked === 'team_1'
          ? { teamId: TeamId.of('team_1'), workspaceId: WorkspaceId.of('ws_1') }
          : null,
      ),
    } satisfies TeamsPort,
    {
      of: vi.fn(async () => ({
        teamId: TeamId.of('team_1'),
        integrations: [],
        skills: [],
      })),
      everywhere: vi.fn(),
    } satisfies AppliedConfigurationPort,
    {
      read: () => ({ skills: [GRAFANA], problems: [] }),
      definedAt: (key: SkillKey) => `.spotlight/skills/${key.value}`,
      folder: vi.fn(),
    } satisfies SkillReaderPort,
  ).execute(new TeamSkillsQuery(teamId, 'user_1'));

describe('TeamSkillsHandler', () => {
  it('lists the team’s own skills, each with where it is defined', async () => {
    await expect(listing()).resolves.toEqual({
      skills: [
        {
          key: 'grafana-dashboards',
          description: 'Reading this team’s dashboards.',
          path: '.spotlight/skills/grafana-dashboards',
        },
      ],
    });
  });

  it('lists nothing for a team that is not the caller’s', async () => {
    await expect(listing('team_2')).resolves.toBeNull();
  });
});

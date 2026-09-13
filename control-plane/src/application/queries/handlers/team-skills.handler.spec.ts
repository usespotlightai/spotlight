import type {
  SkillFolder,
  SkillReaderPort,
} from '@application/ports/skill-reader.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { TeamSkillsHandler } from '@application/queries/handlers/team-skills.handler';
import { TeamSkillsQuery } from '@application/queries/team-skills.query';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { Skill } from '@domain/entities/skill.entity';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
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
      findTeamForMember: vi.fn(async (asked: string) =>
        asked === 'team_1'
          ? {
              workspaceId: 'ws_1',
              teamId: 'team_1',
              teamKey: 'core',
              slug: 'acme',
            }
          : null,
      ),
    } as unknown as WorkspaceReaderPort,
    {
      findFor: vi.fn(async () =>
        TeamConfiguration.read({
          teamId: TeamId.of('team_1'),
          repository: Repository.of('acme/config'),
          commit: Commit.of('a1b2c3d'),
          files: [],
          readAt: new Date('2026-09-13T08:00:00.000Z'),
        }),
      ),
    } as unknown as TeamConfigurationRepository,
    {
      read: () => ({ skills: [GRAFANA], problems: [] }),
    } as unknown as SkillReaderPort,
  ).execute(new TeamSkillsQuery(teamId, 'user_1'));

describe('TeamSkillsHandler', () => {
  it('lists the team’s own skills, each with the folder it is kept in', async () => {
    await expect(listing()).resolves.toEqual({
      repository: 'acme/config',
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

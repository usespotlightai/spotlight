import type {
  SkillFolder,
  SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import { TeamSkillsHandler } from '@configuration/application/queries/handlers/team-skills.handler';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import { Skill } from '@configuration/domain/entities/skill.entity';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
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
      find: vi.fn(),
      inWorkspace: vi.fn(),
      viewedBy: vi.fn(async (asked: string, viewer: UserId) =>
        asked === 'team_1'
          ? {
              teamId: TeamId.of('team_1'),
              workspaceId: WorkspaceId.of('ws_1'),
              connected: false,
              viewer,
              administers: false,
            }
          : null,
      ),
    } satisfies TeamsPort,
    {
      findFor: vi.fn(async () =>
        TeamConfiguration.rehydrate({
          problems: [],
          integrations: [],
          teamId: TeamId.of('team_1'),
          repository: Repository.of('acme/config'),
          commit: Commit.of('a1b2c3d'),
          files: [],
          begunAt: new Date('2026-09-13T08:00:00.000Z'),
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

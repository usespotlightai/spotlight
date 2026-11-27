import type { ReadSkillFolder } from '@configuration/application/ports/skill-folders.port';
import { TeamSkillsHandler } from '@configuration/application/queries/handlers/team-skills.handler';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import type { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { Skill } from '@configuration/domain/value-objects/skill.vo';
import type {
  TeamWorkspaceMembership,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const GRAFANA: ReadSkillFolder = {
  skill: Skill.define({
    key: DefinedSkillKey.of('grafana-dashboards'),
    description: 'Reading this team’s dashboards.',
    instructions: 'Dashboards are at https://grafana.acme.dev.',
    secrets: [],
    tools: [],
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
    partial<WorkspaceAccessPort>({
      inWorkspaceOfTeam: vi.fn((id: TeamId) =>
        Promise.resolve(
          id.value === 'team_1'
            ? partial<TeamWorkspaceMembership>({
                teamId: TeamId.of('team_1'),
                workspaceId: WorkspaceId.of('ws_1'),
              })
            : null,
        ),
      ),
    }),
    partial<TeamSkillReading>({
      of: vi.fn(() => Promise.resolve([GRAFANA])),
    }),
  ).execute(new TeamSkillsQuery(teamId, 'user_1'));

describe('TeamSkillsHandler', () => {
  it('lists the team’s own skills, each with what it is for', async () => {
    await expect(listing()).resolves.toEqual({
      skills: [
        {
          key: 'grafana-dashboards',
          description: 'Reading this team’s dashboards.',
        },
      ],
    });
  });

  it('lists nothing for a team that is not the caller’s', async () => {
    await expect(listing('team_2')).resolves.toBeNull();
  });
});

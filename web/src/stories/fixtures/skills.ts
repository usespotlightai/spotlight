import type { QueryClient } from '@tanstack/react-query';
import { teamSkillKeys } from '@/hooks/api/useTeamSkills';
import type { TeamSkillsResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { TEAM_ID } from '@/stories/fixtures/team';

const SKILLS: TeamSkillsResponseDto = {
  skills: [
    {
      key: 'grafana-dashboards',
      description: 'Reading this team’s dashboards before touching an alert.',
      path: '.spotlight/skills/grafana-dashboards',
    },
    {
      key: 'our-migrations',
      description:
        'Generating database migrations, never writing them by hand.',
      path: '.spotlight/skills/our-migrations',
    },
    {
      key: 'release-notes',
      description: 'Writing release notes in the voice the team uses.',
      path: '.spotlight/skills/release-notes',
    },
  ],
};

export const seedTeamSkills = (client: QueryClient) =>
  client.setQueryData(teamSkillKeys.forTeam(TEAM_ID), SKILLS);

export const emptyTeamSkills = (client: QueryClient) =>
  client.setQueryData(teamSkillKeys.forTeam(TEAM_ID), {
    skills: [],
  } satisfies TeamSkillsResponseDto);

export const failTeamSkills = (client: QueryClient) =>
  failQuery(client, teamSkillKeys.forTeam(TEAM_ID));

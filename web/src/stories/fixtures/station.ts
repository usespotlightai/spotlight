import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { lineKeys } from '@/hooks/api/useLines';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  LineResponseDto,
  RepositoryResponseDto,
  StationResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { SLUG, TEAM_ID, WORKSPACE } from '@/stories/fixtures/team';

export const LINE_ID = 'line_default';
export const STATION_ID = 'station_implementation';

const station = (
  over: Partial<StationResponseDto> & {
    id: string;
    name: string;
    position: number;
  },
): StationResponseDto => ({
  key: over.name.toLowerCase(),
  color: '#5c66d9',
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  kind: 'work',
  skills: [],
  ...over,
});

const LINES: LineResponseDto[] = [
  {
    id: LINE_ID,
    key: 'default',
    name: 'Default',
    reactions: [],
    repositories: ['acme/api', 'acme/web'],
    stations: [
      station({
        id: 'station_backlog',
        name: 'Backlog',
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      station({
        id: 'station_spec',
        name: 'Spec',
        position: 1,
        color: '#b36ae2',
      }),
      station({
        id: STATION_ID,
        name: 'Implementation',
        position: 2,
        description: 'Where a spec becomes a pull request.',
        harness: 'claude-code',
        model: 'opus',
        effort: 'high',
        agentPrompt:
          '## Role\n\nImplement the spec on the task.\n\n- Keep the change small\n- Ask when the spec is unclear',
        skills: ['our-migrations', 'grafana-dashboards'],
      }),
      station({
        id: 'station_completed',
        name: 'Completed',
        position: 3,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  },
];

const HARNESSES: HarnessResponseDto[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [
      { id: 'opus', name: 'Opus' },
      { id: 'sonnet', name: 'Sonnet' },
    ],
    defaultModel: 'sonnet',
    efforts: ['low', 'medium', 'high'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    models: [],
    defaultModel: '',
    efforts: [],
  },
];

const REPOSITORIES: RepositoryResponseDto[] = [
  { fullName: 'acme/api' },
  { fullName: 'acme/web' },
  { fullName: 'acme/spotlight-config' },
];

export const seedStation = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(repositoryKeys.forWorkspace(SLUG), REPOSITORIES);
};

export const failStation = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, lineKeys.forTeam(TEAM_ID));
};
